import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { access, constants } from 'node:fs/promises'
import { homedir } from 'node:os'
import * as path from 'node:path'
import { env } from 'node:process'
import { Uri, workspace } from 'vscode'

export type BinaryLoader = 'node' | 'native'

export interface BinarySearchResult {
  path: string
  loader: BinaryLoader
  yarnPnpLoaderPath?: string
}

/**
 * Returns true only for binary paths that stay inside their directory,
 * contain no shell metacharacters, and name the biome binary.
 */
export function validateSafeBinaryPath(binaryPath: string): boolean {
  if (binaryPath.includes('..')) {
    return false
  }

  const maliciousChars = /[&|;$<>`\r\n]/
  if (maliciousChars.test(binaryPath)) {
    return false
  }

  const lowerPath = binaryPath.toLowerCase()
  if (!lowerPath.includes('biome')) {
    return false
  }

  return true
}

/** @internal only used for testing */
export function replaceTargetFromMainToBin(
  resolvedPath: string,
  binaryName: string,
): string {
  // why: the owning package.json can sit any number of levels above the resolved file.
  let dir = path.dirname(resolvedPath)
  while (dir !== path.dirname(dir)) {
    let rawContent: string
    try {
      rawContent = readFileSync(path.join(dir, 'package.json'), 'utf8')
    } catch {
      dir = path.dirname(dir)
      continue
    }
    const packageJson: { bin?: string | Record<string, string> } =
      JSON.parse(rawContent)
    const binEntry =
      typeof packageJson.bin === 'string'
        ? packageJson.bin
        : packageJson.bin?.[binaryName]
    if (!binEntry) {
      throw new Error(`No bin entry for "${binaryName}" found in package.json`)
    }
    return path.resolve(dir, binEntry)
  }
  throw new Error(`Could not find package.json for "${binaryName}"`)
}

async function searchNodeModulesDefaultBinPath(
  binaryName: string,
  folders: string[],
): Promise<BinarySearchResult | undefined> {
  const candidates = folders.flatMap((folder) => {
    const basePath = path.join(folder, '.bin', binaryName)
    return process.platform === 'win32'
      ? [basePath, `${basePath}.exe`]
      : [basePath]
  })

  const exists = await Promise.all(
    candidates.map(async (candidate) => {
      try {
        await workspace.fs.stat(Uri.file(candidate))
        return true
      } catch {
        return false
      }
    }),
  )

  const firstExistingCandidateIndex = exists.findIndex(Boolean)
  if (firstExistingCandidateIndex === -1) {
    return undefined
  }

  return { path: candidates[firstExistingCandidateIndex], loader: 'native' }
}

/**
 * Returns node_modules paths derived from all package.json files found in the workspace.
 * The result is cached after the first call to avoid repeated file system scans.
 */
let cachedWorkspacePackageJsonNodeModules: Promise<string[]> | undefined
function getWorkspacePackageJsonNodeModules(): Promise<string[]> {
  if (!cachedWorkspacePackageJsonNodeModules) {
    cachedWorkspacePackageJsonNodeModules = Promise.resolve(
      workspace
        .findFiles('**/package.json', '**/node_modules/**')
        .then((uris) =>
          uris.map((uri) =>
            path.join(path.dirname(uri.fsPath), 'node_modules'),
          ),
        ),
    )
  }
  return cachedWorkspacePackageJsonNodeModules
}

/** @internal only used for clearing test states */
export function clearWorkspacePackageJsonNodeModulesCache(): void {
  cachedWorkspacePackageJsonNodeModules = undefined
}

/**
 * Searches for the binary in the node_modules bin directories of every
 * workspace folder. When several folders contain the binary, the first match wins.
 */
export async function searchProjectNodeModulesBin(
  binaryName: string,
): Promise<BinarySearchResult | undefined> {
  const workspaceNodeModules = (workspace.workspaceFolders ?? []).map(
    (folder) => path.join(folder.uri.fsPath, 'node_modules'),
  )
  const result = await searchNodeModulesDefaultBinPath(
    binaryName,
    workspaceNodeModules,
  )
  if (result) {
    return result
  }

  // why: monorepo packages keep their own node_modules below the workspace root.
  const packageJsonNodeModules = await getWorkspacePackageJsonNodeModules()
  const result2 = await searchNodeModulesDefaultBinPath(
    binaryName,
    packageJsonNodeModules,
  )
  if (result2) {
    return result2
  }

  // why: the direct lookup is the last local option before giving up on project binaries.
  try {
    const resolvedPath = replaceTargetFromMainToBin(
      require.resolve(binaryName, {
        paths:
          workspace.workspaceFolders?.map((folder) => folder.uri.fsPath) ?? [],
      }),
      binaryName,
    )
    return { path: resolvedPath, loader: 'node' }
  } catch {}
}

interface PnpApi {
  resolveRequest(request: string, issuer: string): string | null
}

function isPnpApi(value: unknown): value is PnpApi {
  return (
    typeof value === 'object' &&
    value !== null &&
    'resolveRequest' in value &&
    typeof value.resolveRequest === 'function'
  )
}

/**
 * Walks up from the start directory to find and load a Yarn PnP runtime.
 * Returns the PnP API object and the absolute path to the loader file.
 *
 * Loading executes third-party JavaScript, so callers must only invoke this
 * in trusted workspaces.
 */
function findPnpApi(
  startDir: string,
): { api: PnpApi; loaderPath: string } | undefined {
  let dir = startDir
  while (dir !== path.dirname(dir)) {
    for (const name of ['.pnp.cjs', '.pnp.js']) {
      try {
        const pnpFilePath = path.join(dir, name)
        const loaded: unknown = require(pnpFilePath)
        if (isPnpApi(loaded)) {
          return { api: loaded, loaderPath: pnpFilePath }
        }
      } catch {
        // why: most levels have no PnP file, so keep climbing instead of failing.
      }
    }
    dir = path.dirname(dir)
  }
  return undefined
}

/**
 * Searches for the binary through Yarn PnP resolution, climbing toward the
 * workspace root so monorepos resolve. Returns the binary path together with
 * the PnP loader path needed for require injection.
 */
export async function searchYarnPnpBin(
  binaryName: string,
): Promise<BinarySearchResult | undefined> {
  if (!workspace.isTrusted) {
    return undefined
  }

  const results = await Promise.all(
    (workspace.workspaceFolders ?? []).map(async (folder) => {
      const folderPath = folder.uri.fsPath
      const pnpResult = findPnpApi(folderPath)
      if (!pnpResult) return undefined
      try {
        const resolvedMain = pnpResult.api.resolveRequest(
          binaryName,
          folderPath + path.sep,
        )
        if (!resolvedMain) return undefined
        const binPath = replaceTargetFromMainToBin(resolvedMain, binaryName)
        await workspace.fs.stat(Uri.file(binPath))
        return {
          path: binPath,
          loader: 'node',
          yarnPnpLoaderPath: pnpResult.loaderPath,
        } as const
      } catch {
        return undefined
      }
    }),
  )

  return results.find(Boolean)
}

/**
 * Searches for the binary in the global package directories.
 * Returns undefined when nothing is found.
 */
export async function searchGlobalNodeModulesBin(
  binaryName: string,
): Promise<BinarySearchResult | undefined> {
  const globalPaths = globalNodeModulesPaths()

  const result = await searchNodeModulesDefaultBinPath(binaryName, globalPaths)
  if (result) {
    return result
  }

  // why: a globally linked binary is the last option before searching the system PATH.
  try {
    const resolvedPath = replaceTargetFromMainToBin(
      require.resolve(binaryName, { paths: globalPaths }),
      binaryName,
    )
    return { path: resolvedPath, loader: 'node' }
  } catch {}
}

/**
 * Searches for the binary on the system PATH.
 * Returns undefined when nothing is found.
 */
export async function searchEnvPath(
  defaultBinaryName: string,
): Promise<BinarySearchResult | undefined> {
  const envPath = env.PATH

  if (!envPath) {
    return undefined
  }

  const candidates = envPath.split(path.delimiter).flatMap((folder) => {
    // why: a leading or trailing delimiter yields empty segments with no folder to probe.
    if (!folder) {
      return []
    }
    const basePath = path.join(folder, defaultBinaryName)
    return process.platform === 'win32'
      ? [basePath, `${basePath}.exe`]
      : [basePath]
  })

  const binary = await Promise.all(
    candidates.map(async (candidate) => {
      const candidateUri = Uri.file(candidate)
      try {
        await workspace.fs.stat(candidateUri)
        return { path: candidateUri.fsPath, loader: 'native' } as const
      } catch {
        return undefined
      }
    }),
  )

  return binary.find(Boolean)
}

/**
 * Resolves the user-configured binary path, treating relative paths as
 * relative to the first workspace folder. Returns undefined when the path is
 * unsafe or points nowhere.
 */
export async function searchSettingsBin(
  defaultBinaryName: string,
  settingsBinary: string,
): Promise<BinarySearchResult | undefined> {
  if (!workspace.isTrusted) {
    return
  }

  if (!validateSafeBinaryPath(settingsBinary)) {
    return undefined
  }

  let resolvedPath = settingsBinary

  if (!path.isAbsolute(resolvedPath)) {
    const cwd = workspace.workspaceFolders?.[0]?.uri.fsPath
    if (!cwd) {
      return undefined
    }
    // why: resolve the setting against the only workspace guaranteed to exist.
    resolvedPath = path.normalize(path.join(cwd, resolvedPath))
  }

  if (process.platform !== 'win32' && resolvedPath.endsWith('.exe')) {
    resolvedPath = resolvedPath.slice(0, -4)
  }

  const isNode =
    resolvedPath.endsWith('.js') ||
    resolvedPath.endsWith('.cjs') ||
    resolvedPath.endsWith('.mjs') ||
    resolvedPath.endsWith(
      `${defaultBinaryName}${path.sep}bin${path.sep}${defaultBinaryName}`,
    )

  try {
    await workspace.fs.stat(Uri.file(resolvedPath))
    return { path: resolvedPath, loader: isNode ? 'node' : 'native' }
  } catch {}

  // why: some runtimes ship Windows binaries with an exe suffix, so probe it before giving up.
  if (process.platform === 'win32') {
    if (!resolvedPath.endsWith('.exe')) {
      resolvedPath += '.exe'
    }

    try {
      await workspace.fs.stat(Uri.file(resolvedPath))
      return { path: resolvedPath, loader: 'native' }
    } catch {}
  }

  return undefined
}

// adapted from the global-modules locator in the official Biome extension:
// https://github.com/biomejs/biome-vscode/blob/ae9b6df2254d0ff8ee9d626554251600eb2ca118/src/locator.ts#L28-L49
function globalNodeModulesPaths(): string[] {
  const npmGlobalNodeModulesPath = safeSpawnSync('npm', ['root', '-g'])
  const pnpmGlobalNodeModulesPath = safeSpawnSync('pnpm', ['root', '-g'])
  const bunGlobalNodeModulesPath = path.resolve(
    homedir(),
    '.bun/install/global/node_modules',
  )

  return [
    npmGlobalNodeModulesPath,
    pnpmGlobalNodeModulesPath,
    bunGlobalNodeModulesPath,
  ].filter(Boolean) as string[]
}

// safety: call only with internal constant commands, never with user-controlled input.
const safeSpawnSync = (
  command: string,
  args: readonly string[] = [],
): string | undefined => {
  let output: string | undefined

  try {
    const result = spawnSync(command, args, {
      shell: true,
      encoding: 'utf8',
    })

    if (result.error || result.status !== 0) {
      output = undefined
    } else {
      const trimmed = result.stdout.trim()
      output = trimmed ? trimmed : undefined
    }
  } catch {
    output = undefined
  }

  return output
}

/**
 * Falls back to the biome binary bundled with the extension, preferring the
 * per-platform subdirectory written by the copy script over the legacy flat copy.
 */
export async function searchBundledBiomeBin(): Promise<
  BinarySearchResult | undefined
> {
  const binaryName = process.platform === 'win32' ? 'biome.exe' : 'biome'
  const platformArch = `${process.platform}-${process.arch}`
  const candidates = [
    path.join(__dirname, 'biome-bin', platformArch, binaryName),
    path.join(__dirname, 'biome-bin', binaryName),
  ]
  for (const bundlePath of candidates) {
    try {
      await access(bundlePath, constants.F_OK)
      return { path: bundlePath, loader: 'native' }
    } catch {
      // why: the first candidate simply may not exist, so fall through to the next.
    }
  }
  return undefined
}

/**
 * Searches for the binary in the extension's own dependencies as a final fallback.
 */
export async function searchExtensionNodeModulesBin(
  binaryName: string,
): Promise<BinarySearchResult | undefined> {
  try {
    // why: inside the extension host this resolves the bundled copy.
    const resolvedPath = replaceTargetFromMainToBin(
      require.resolve('@biomejs/biome'),
      binaryName,
    )
    return { path: resolvedPath, loader: 'node' }
  } catch {
    return undefined
  }
}

/**
 * Reports whether the file at the given path can actually be executed.
 *
 * Unix probes execute permission directly. On Windows that probe is
 * meaningless, so existence is checked instead while command shims are
 * rejected, since those pass the existence probe but crash the language
 * server on startup.
 */
export async function isExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath, constants.X_OK)
    return true
  } catch {
    if (process.platform === 'win32') {
      try {
        await access(filePath, constants.F_OK)
        return !filePath.endsWith('.cmd')
      } catch {
        return false
      }
    }
    return false
  }
}

/**
 * Tries each binary search strategy in priority order, starting with the
 * user setting and ending with the bundled extension copy, and returns the
 * first result that passes the executable check.
 *
 * The check exists because stale bin shims pass a plain existence probe but
 * crash the language server on startup.
 */
export async function findExecutableBinary(
  binaryName: string,
  settingsBinary?: string,
): Promise<BinarySearchResult | undefined> {
  const strategies: (() => Promise<BinarySearchResult | undefined>)[] = [
    ...(settingsBinary
      ? [() => searchSettingsBin(binaryName, settingsBinary)]
      : []),
    () => searchProjectNodeModulesBin(binaryName),
    () => searchYarnPnpBin(binaryName),
    () => searchGlobalNodeModulesBin(binaryName),
    () => searchEnvPath(binaryName),
    () => searchBundledBiomeBin(),
    () => searchExtensionNodeModulesBin(binaryName),
  ]

  for (const strategy of strategies) {
    const result = await strategy()
    if (result && (await isExecutable(result.path))) {
      return result
    }
  }

  return undefined
}

/** @internal only used for clearing test states */
export function clearFindExecutableBinaryCache(): void {
  clearWorkspacePackageJsonNodeModulesCache()
}

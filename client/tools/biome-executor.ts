import * as os from 'node:os'
import * as path from 'node:path'
import { type LogOutputChannel, window, workspace } from 'vscode'
import type { BinarySearchResult } from '../findBinary'
import type { VSCodeConfig } from '../VSCodeConfig'

export interface BiomeExecutionConfig {
  command: string
  args: string[]
  options: {
    cwd: string
    env: Record<string, string>
    shell: boolean
  }
}

export interface BiomeExecutorOptions {
  binary: BinarySearchResult | undefined
  vscodeConfig: VSCodeConfig
  biomeArgs: string[]
  cwd?: string
  extraEnv?: Record<string, string>
  outputChannel?: LogOutputChannel
  commandLabel?: string
}

/**
 * Shared binary execution logic for Biome CLI commands.
 * Eliminates duplication between LSP server startup (lsp_helper.ts)
 * and project-level CLI commands (commands.ts).
 */
export function buildBiomeExecutionConfig(
  options: BiomeExecutorOptions,
): BiomeExecutionConfig | undefined {
  const {
    binary,
    vscodeConfig,
    biomeArgs,
    cwd = workspace.workspaceFolders?.[0]?.uri.fsPath || os.homedir(),
    extraEnv = {},
  } = options

  if (!binary) {
    return undefined
  }

  const isWindows = os.platform() === 'win32'
  const isNode = binary.loader === 'node'

  const nodeCommand = resolveNodeCommand(
    vscodeConfig.nodePath,
    vscodeConfig.useExecPath,
  )

  const serverEnv: Record<string, string> = {
    ...process.env,
    ...extraEnv,
    NO_COLOR: '1',
  }

  if (vscodeConfig.useExecPath) {
    serverEnv.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete serverEnv.ELECTRON_RUN_AS_NODE
  }

  if (path.isAbsolute(nodeCommand)) {
    const nodeDir = path.dirname(nodeCommand)
    serverEnv.PATH = `${nodeDir}${isWindows ? ';' : ':'}${process.env.PATH ?? ''}`
  }

  const pnpArgs: string[] = []
  if (isNode && binary.yarnPnpLoaderPath) {
    pnpArgs.push('--require', binary.yarnPnpLoaderPath)
    const esmLoaderPath = path.join(
      path.dirname(binary.yarnPnpLoaderPath),
      '.pnp.loader.mjs',
    )
    pnpArgs.push('--loader', esmLoaderPath)
  }

  let command: string
  let args: string[]
  let shell = false

  if (isNode || vscodeConfig.useExecPath) {
    command = nodeCommand
    args = [...pnpArgs, binary.path, ...biomeArgs]
  } else {
    command = isWindows ? `"${binary.path}"` : binary.path
    args = [...biomeArgs]
    shell = isWindows
  }

  return {
    command,
    args,
    options: {
      cwd,
      env: serverEnv,
      shell,
    },
  }
}

/**
 * Executes a Biome command and handles the result.
 * If the command fails, opens a terminal with the command for user visibility.
 */
export async function executeBiomeCommand(
  options: BiomeExecutorOptions & {
    successMessage?: string
    failureMessage?: string
  },
): Promise<void> {
  const {
    binary,
    vscodeConfig,
    biomeArgs,
    cwd,
    extraEnv,
    outputChannel,
    commandLabel,
    successMessage,
    failureMessage,
  } = options

  const config = buildBiomeExecutionConfig({
    binary,
    vscodeConfig,
    biomeArgs,
    cwd,
    extraEnv,
  })

  if (!config) {
    window.showErrorMessage(
      failureMessage ||
        `Biome binary not found. Cannot ${commandLabel?.toLowerCase() || 'run command'}.`,
    )
    return
  }

  const { execFile } = await import('node:child_process')

  return new Promise((resolve) => {
    execFile(
      config.command,
      config.args,
      config.options,
      (error, stdout, stderr) => {
        if (error) {
          if (outputChannel) {
            outputChannel.error(
              `'biome ${biomeArgs.join(' ')}' failed: ${error.message}`,
            )
            if (stderr) {
              outputChannel.error(stderr)
            }
          }

          // On failure, run in terminal for user visibility
          const terminal = window.createTerminal({
            name: `Biome ${commandLabel || 'Command'}`,
            cwd: config.options.cwd,
            env: config.options.env,
          })

          let terminalCommand: string
          if (config.options.shell) {
            terminalCommand = `${config.command} ${config.args.join(' ')}`
          } else {
            terminalCommand = `${config.command} ${config.args.join(' ')}`
          }

          terminal.show()
          terminal.sendText(terminalCommand)
          resolve()
          return
        }

        if (outputChannel && stdout) {
          outputChannel.info(stdout)
        }
        if (successMessage) {
          window.showInformationMessage(successMessage)
        }
        resolve()
      },
    )
  })
}

function resolveNodeCommand(nodePath?: string, useExecPath?: boolean): string {
  if (useExecPath) {
    return process.execPath || nodePath || 'node'
  }
  return nodePath || 'node'
}

/**
 * Builds the Executable configuration for LanguageClient.
 * This is the LSP-specific variant that returns an Executable object.
 */
export function buildLspExecutable(
  binary: BinarySearchResult,
  vscodeConfig: VSCodeConfig,
  extraEnv: Record<string, string> = {},
): {
  command: string
  args: string[]
  options: {
    env: Record<string, string>
    shell?: boolean
  }
} {
  const isNode = binary.loader === 'node'

  const nodeCommand = resolveNodeCommand(
    vscodeConfig.nodePath,
    vscodeConfig.useExecPath,
  )

  const serverEnv: Record<string, string> = {
    ...process.env,
    ...extraEnv,
    RUST_LOG: process.env.RUST_LOG || 'info',
    BIOME_LOG: process.env.BIOME_LOG || 'info',
    NO_COLOR: '1',
  }

  if (vscodeConfig.useExecPath) {
    serverEnv.ELECTRON_RUN_AS_NODE = '1'
  } else {
    delete serverEnv.ELECTRON_RUN_AS_NODE
  }

  if (path.isAbsolute(nodeCommand)) {
    const nodeDir = path.dirname(nodeCommand)
    serverEnv.PATH = `${nodeDir}${os.platform() === 'win32' ? ';' : ':'}${process.env.PATH ?? ''}`
  }

  const pnpArgs: string[] = []
  if (isNode && binary.yarnPnpLoaderPath) {
    pnpArgs.push('--require', binary.yarnPnpLoaderPath)
    const esmLoaderPath = path.join(
      path.dirname(binary.yarnPnpLoaderPath),
      '.pnp.loader.mjs',
    )
    pnpArgs.push('--loader', esmLoaderPath)
  }

  if (isNode || vscodeConfig.useExecPath) {
    return {
      command: nodeCommand,
      args: [...pnpArgs, binary.path, 'lsp-proxy'],
      options: { env: serverEnv },
    }
  }

  const isWindows = os.platform() === 'win32'
  return {
    command: isWindows ? `"${binary.path}"` : binary.path,
    args: ['lsp-proxy'],
    options: {
      shell: isWindows,
      env: serverEnv,
    },
  }
}

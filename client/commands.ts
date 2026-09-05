import { execFile } from 'node:child_process'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  env,
  type LogOutputChannel,
  Uri,
  version,
  window,
  workspace,
} from 'vscode'
import type { BinarySearchResult } from './findBinary'
import type { VSCodeConfig } from './VSCodeConfig'
import { executeBiomeCommand } from './tools/biome-executor'

export enum BiomeCommands {
  ShowOutput = 'biome.showOutput',
  Restart = 'biome.restart',
  ToggleEnabled = 'biome.toggleEnabled',
  ApplyAllFixes = 'biome.applyAllFixes',
  FormatProject = 'biome.formatProject',
  FixProject = 'biome.fixProject',
  FixProjectUnsafe = 'biome.fixProjectUnsafe',
  OpenConfig = 'biome.openConfig',
  CopyDebugInfo = 'biome.copyDebugInfo',
  Rage = 'biome.rage',
  AddCustomConfig = 'biome.addCustomConfig',
  SpawnConfig = 'biome.spawnConfig',
  OpenConfigManager = 'biome.openConfigManager',
}

export enum LspCommands {
  FixAll = 'biome.fixAll',
}

export async function copyDebugCommand(
  extensionVersion: string,
  biomeVersion: string,
  vscodeConfig: VSCodeConfig,
) {
  const osName = getOsName()
  const nodeCommand = resolveNodeCommand(
    vscodeConfig.nodePath,
    vscodeConfig.useExecPath,
  )
  const nodeVersion = await getNodeVersion(nodeCommand)

  const info = [
    '### Used Versions',
    '',
    '',
    `VS Code extension: v${extensionVersion}`,
    `biome: v${biomeVersion}`,
    `Editor: ${env.appName} v${version} (${env.appHost})`,
    `Operating System and Version: ${osName} (${os.release()})`,
    `Node Version: ${nodeVersion} (${nodeCommand})`,
    '',
  ].join('\n')

  await env.clipboard.writeText(info)
  window.showInformationMessage('Debug info copied to clipboard.')
}

/**
 * Executes 'biome rage' and prints the output to a channel.
 */
export async function rageCommand(
  binary: BinarySearchResult | undefined,
  outputChannel: LogOutputChannel,
  vscodeConfig: VSCodeConfig,
) {
  await executeBiomeCommand({
    binary,
    vscodeConfig,
    biomeArgs: ['rage'],
    outputChannel,
    commandLabel: 'Rage',
    extraEnv: {
      RUST_LOG: process.env.RUST_LOG || 'info',
      BIOME_LOG: process.env.BIOME_LOG || 'info',
    },
    successMessage: undefined, // rage outputs to channel, no success toast
  })
}

/**
 * Generic function to run Biome command on the whole project.
 */
async function runBiomeOnProject(
  binary: BinarySearchResult | undefined,
  vscodeConfig: VSCodeConfig,
  biomeArgs: string[],
  commandLabel: string,
  successMessage: string,
) {
  const activeEditor = window.activeTextEditor
  const workspaceFolder = activeEditor
    ? workspace.getWorkspaceFolder(activeEditor.document.uri)
    : workspace.workspaceFolders?.[0]

  if (!workspaceFolder) {
    window.showErrorMessage(
      `No workspace folder found to ${commandLabel.toLowerCase()}.`,
    )
    return
  }

  await executeBiomeCommand({
    binary,
    vscodeConfig,
    biomeArgs,
    cwd: workspaceFolder.uri.fsPath,
    commandLabel,
    successMessage,
  })
}

/**
 * Executes 'biome format --write .' in the active workspace.
 */
export async function formatProjectCommand(
  binary: BinarySearchResult | undefined,
  vscodeConfig: VSCodeConfig,
) {
  await runBiomeOnProject(
    binary,
    vscodeConfig,
    ['format', '--write', '.'],
    'Format Project',
    'Project formatted successfully.',
  )
}

/**
 * Executes 'biome check --write .' in the active workspace.
 */
export async function fixProjectCommand(
  binary: BinarySearchResult | undefined,
  vscodeConfig: VSCodeConfig,
) {
  await runBiomeOnProject(
    binary,
    vscodeConfig,
    ['check', '--write', '.'],
    'Fix Project',
    'Project fixed successfully.',
  )
}

/**
 * Executes 'biome check --write --unsafe .' in the active workspace.
 */
export async function fixProjectUnsafeCommand(
  binary: BinarySearchResult | undefined,
  vscodeConfig: VSCodeConfig,
) {
  await runBiomeOnProject(
    binary,
    vscodeConfig,
    ['check', '--write', '--unsafe', '.'],
    'Fix Project (Unsafe)',
    'Project fixed (with unsafe fixes) successfully.',
  )
}

/**
 * Opens the Biome configuration file relevant to the active editor.
 */
export async function openConfigCommand() {
  const activeEditor = window.activeTextEditor
  const workspaceFolder = activeEditor
    ? workspace.getWorkspaceFolder(activeEditor.document.uri)
    : workspace.workspaceFolders?.[0]

  if (!workspaceFolder) {
    window.showErrorMessage('No workspace folder found.')
    return
  }

  // Look for biome configuration files in the current folder or above
  const configFiles = [
    'biome.json',
    'biome.jsonc',
    '.biome.json',
    '.biome.jsonc',
  ]

  let currentPath = activeEditor
    ? path.dirname(activeEditor.document.uri.fsPath)
    : workspaceFolder.uri.fsPath

  const workspaceRoot = workspaceFolder.uri.fsPath

  while (currentPath.startsWith(workspaceRoot)) {
    for (const configFile of configFiles) {
      const configUri = Uri.file(path.join(currentPath, configFile))
      try {
        await workspace.fs.stat(configUri)
        const doc = await workspace.openTextDocument(configUri)
        await window.showTextDocument(doc)
        return
      } catch {
        // Continue
      }
    }
    const parentPath = path.dirname(currentPath)
    if (parentPath === currentPath) break
    currentPath = parentPath
  }

  window.showErrorMessage('Biome configuration file not found.')
}

function getNodeVersion(nodeCommand: string): Promise<string> {
  return new Promise((resolve) => {
    execFile(nodeCommand, ['--version'], { timeout: 5000 }, (error, stdout) => {
      if (error) {
        resolve('unknown')
      } else {
        resolve(stdout.trim())
      }
    })
  })
}

function getOsName(): string {
  switch (os.platform()) {
    case 'darwin':
      return 'macOS'
    case 'win32':
      return 'Windows'
    case 'linux':
      return 'Linux'
    default:
      return os.platform()
  }
}

function resolveNodeCommand(nodePath?: string, useExecPath?: boolean): string {
  if (useExecPath) {
    return process.execPath || nodePath || 'node'
  }
  return nodePath || 'node'
}

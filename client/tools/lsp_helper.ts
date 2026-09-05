import { type Executable } from 'vscode-languageclient/node'
import { MessageType, type ShowMessageParams } from 'vscode-languageclient/node'
import { type LogOutputChannel, window } from 'vscode'
import type { BinarySearchResult } from '../findBinary'
import type { VSCodeConfig } from '../VSCodeConfig'
import { buildLspExecutable } from './biome-executor'

export function runExecutable(
  binary: BinarySearchResult,
  useExecPath: boolean = false,
  nodePath?: string,
  tsgolintPath?: string,
  suppressProgramErrors?: boolean,
): Executable {
  const vscodeConfig: Pick<VSCodeConfig, 'nodePath' | 'useExecPath'> = {
    nodePath,
    useExecPath,
  }

  const extraEnv: Record<string, string> = {}
  if (tsgolintPath) {
    extraEnv.BIOME_TSGOLINT_PATH = tsgolintPath
  }
  if (suppressProgramErrors) {
    extraEnv.BIOME_TSGOLINT_DANGEROUSLY_SUPPRESS_PROGRAM_DIAGNOSTICS = 'true'
  }

  const { command, args, options } = buildLspExecutable(
    binary,
    vscodeConfig as VSCodeConfig,
    extraEnv,
  )

  // Convert to Executable type
  const executable: Executable = {
    command,
    args,
    options: options as Executable['options'],
  }

  return executable
}

export function onClientNotification(
  params: ShowMessageParams,
  outputChannel: LogOutputChannel,
) {
  try {
    switch (params.type) {
      case MessageType.Debug:
        outputChannel.debug(params.message)
        break
      case MessageType.Log:
        outputChannel.info(params.message)
        break
      case MessageType.Info:
        window.showInformationMessage(params.message)
        break
      case MessageType.Warning:
        window.showWarningMessage(params.message)
        break
      case MessageType.Error:
        window.showErrorMessage(params.message)
        break
      default:
        outputChannel.info(params.message)
    }
  } catch (e) {
    outputChannel.error(`Biome: Error handling server notification: ${e}`)
  }
}

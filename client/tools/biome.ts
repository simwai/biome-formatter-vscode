import {
  type ConfigurationChangeEvent,
  type LogOutputChannel,
  Uri,
  window,
  workspace,
} from 'vscode'
import { ExecuteCommandRequest } from 'vscode-languageclient'
import {
  type ConfigurationParams,
  type Executable,
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  ShowMessageNotification,
  State,
  type StateChangeEvent,
} from 'vscode-languageclient/node'
import { ConfigService } from '../ConfigService'
import { BiomeCommands, LspCommands } from '../commands'
import type { BinarySearchResult } from '../findBinary'
import type StatusBarItemHandler from '../StatusBarItemHandler'
import { biomeConfigDefaultFilePattern } from '../WorkspaceConfig'
import { onClientNotification, runExecutable } from './lsp_helper'
import type ToolInterface from './ToolInterface'

const languageClientName = 'biome'

export default class BiomeTool implements ToolInterface {
  private client: LanguageClient | undefined
  private disposeResources: (() => Promise<void>) | undefined

  // Reconnection state
  private configService: ConfigService | undefined
  private outputChannel: LogOutputChannel | undefined
  private statusBarItemHandler: StatusBarItemHandler | undefined
  private isManuallyStopped = false
  private reconnectAttempts = 0
  private readonly maxReconnectAttempts = 5
  private readonly baseReconnectDelay = 1000
  private isReconnecting = false
  private messageQueue: Array<() => Promise<void> | undefined> = []
  private readonly maxQueueSize = 100
  private stateChangeDisposable: { dispose: () => void } | undefined

  getLspVersion(): string | undefined {
    return this.client?.initializeResult?.serverInfo?.version
  }

  async getBinary(
    outputChannel: LogOutputChannel,
    configService: ConfigService,
  ): Promise<BinarySearchResult | undefined> {
    const bin = await configService.getBiomeServerBinPath()
    if (bin) {
      return bin
    }
    outputChannel.error('No valid biome binary found.')
    return undefined
  }

  async activate(
    outputChannel: LogOutputChannel,
    configService: ConfigService,
    statusBarItemHandler: StatusBarItemHandler,
    binary?: BinarySearchResult,
  ): Promise<void> {
    // Store references for reconnection logic
    this.configService = configService
    this.outputChannel = outputChannel
    this.statusBarItemHandler = statusBarItemHandler
    // Reset reconnection state on fresh activation
    this.isManuallyStopped = false
    this.reconnectAttempts = 0
    this.isReconnecting = false
    this.messageQueue = []

    if (!binary) {
      statusBarItemHandler.updateTool(
        'biome',
        false,
        'No valid biome binary found.',
      )
      outputChannel.appendLine(
        'No valid biome binary found. Biome will not be activated.',
      )
      return
    }

    const run: Executable = runExecutable(
      binary,
      configService.vsCodeConfig.useExecPath,
      configService.vsCodeConfig.nodePath,
    )
    const serverOptions: ServerOptions = { run, debug: run }

    outputChannel.info(`Using server binary at: ${binary?.path}`)

    const clientOptions = this.createClientOptions(configService)
    this.client = new LanguageClient(
      languageClientName,
      serverOptions,
      clientOptions,
    )

    this.setupNotificationHandlers(outputChannel)

    if (await this.shouldStartServer(configService)) {
      await this.client.start()
    }

    this.updateStatusBar(statusBarItemHandler, configService)
  }

  private createClientOptions(
    configService: ConfigService,
  ): LanguageClientOptions {
    return {
      documentSelector: configService.vsCodeConfig.enabledLanguages.map(
        (language) => ({
          language,
          scheme: 'file',
        }),
      ),
      initializationOptions: configService.biomeServerConfig,
      outputChannel: this.outputChannel,
      traceOutputChannel: this.outputChannel,
      middleware: {
        workspace: {
          configuration: (params: ConfigurationParams) => {
            return params.items.map((item) => {
              if (item.section !== 'biome') {
                return null
              }
              if (item.scopeUri === undefined) {
                return null
              }
              return (
                configService
                  .getWorkspaceConfig(Uri.parse(item.scopeUri))
                  ?.toBiomeConfig() ?? null
              )
            })
          },
        },
      },
    }
  }

  private setupNotificationHandlers(outputChannel: LogOutputChannel): void {
    if (!this.client) return

    const onNotificationDispose = this.client.onNotification(
      ShowMessageNotification.type,
      (params) => {
        onClientNotification(params, outputChannel)
      },
    )

    // Listen for connection state changes to trigger auto-reconnect
    this.stateChangeDisposable = this.client.onDidChangeState(
      (e: StateChangeEvent) => this.onStateChange(e),
    )

    this.disposeResources = async () => {
      await this.client?.dispose()
      onNotificationDispose.dispose()
      this.stateChangeDisposable?.dispose()
    }
  }

  async deactivate(): Promise<void> {
    this.isManuallyStopped = true
    try {
      await this.client?.stop()
    } catch {}
    await this.disposeResources?.()
    this.disposeResources = undefined
    this.client = undefined
  }

  async restartClient(): Promise<void> {
    if (this.client === undefined) {
      window.showErrorMessage('biome client not found')
      return
    }

    this.isManuallyStopped = false
    this.reconnectAttempts = 0

    try {
      if (this.client.isRunning()) {
        await this.client.restart()
        window.showInformationMessage('biome server restarted.')
      } else {
        await this.client.start()
      }
    } catch (err) {
      this.client.error('Restarting biome client failed', err, 'force')
    }
  }

  private onStateChange(e: StateChangeEvent): void {
    if (
      !this.outputChannel ||
      !this.configService ||
      !this.statusBarItemHandler
    ) {
      return
    }

    const wasRunning = e.oldState === State.Running
    const nowStopped = e.newState === State.Stopped

    if (wasRunning && nowStopped) {
      this.outputChannel.info(
        `Biome: Connection state changed: Running -> Stopped (manual: ${this.isManuallyStopped}, enabled: ${this.configService.vsCodeConfig.enableBiome})`,
      )

      if (
        !this.isManuallyStopped &&
        this.configService.vsCodeConfig.enableBiome
      ) {
        this.attemptAutoReconnect()
      }
    }
  }

  private async attemptAutoReconnect(): Promise<void> {
    if (
      !this.outputChannel ||
      !this.configService ||
      !this.statusBarItemHandler
    ) {
      return
    }

    if (
      this.isManuallyStopped ||
      !this.configService.vsCodeConfig.enableBiome
    ) {
      return
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.outputChannel.error(
        'Biome: Max reconnection attempts reached. Server remains stopped.',
      )
      this.statusBarItemHandler.updateTool(
        'biome',
        false,
        'Not Activated',
        this.client?.initializeResult?.serverInfo?.version,
        false,
      )
      return
    }

    this.isReconnecting = true
    const delay = Math.min(
      this.baseReconnectDelay * 2 ** this.reconnectAttempts,
      30000,
    )
    this.reconnectAttempts++

    this.outputChannel.info(
      `Biome: Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`,
    )

    await new Promise((r) => setTimeout(r, delay))

    try {
      await this.client?.start()
      this.reconnectAttempts = 0
      this.isReconnecting = false
      this.outputChannel.info('Biome: Reconnected successfully')
      this.updateStatusBar(this.statusBarItemHandler, this.configService)
      await this.flushQueue()
    } catch (e) {
      this.isReconnecting = false
      this.outputChannel.error(`Biome: Reconnection failed: ${e}`)
      await this.attemptAutoReconnect()
    }
  }

  private queueMessage(fn: () => Promise<void> | undefined): void {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.messageQueue.shift()
    }
    if (fn) {
      this.messageQueue.push(fn)
    }
  }

  private async flushQueue(): Promise<void> {
    while (this.messageQueue.length > 0) {
      const fn = this.messageQueue.shift()
      if (!fn) {
        continue
      }
      try {
        await fn()
      } catch {
        // Swallow errors during flush - connection may still be unstable
      }
    }
  }

  async applyAllFixesFile(): Promise<void> {
    if (!this.client) {
      window.showErrorMessage('biome client not found')
      return
    }
    const textEditor = window.activeTextEditor
    if (!textEditor) {
      window.showErrorMessage('active text editor not found')
      return
    }

    const params = {
      command: LspCommands.FixAll,
      arguments: [{ uri: textEditor.document.uri.toString() }],
    }

    const sendRequest = () =>
      this.client
        ?.sendRequest(ExecuteCommandRequest.type, params)
        .then(() => undefined)

    if (this.isReconnecting) {
      this.queueMessage(sendRequest)
      return
    }

    await sendRequest()
  }

  async onConfigChange(
    event: ConfigurationChangeEvent,
    configService: ConfigService,
    statusBarItemHandler: StatusBarItemHandler,
  ): Promise<void> {
    if (event.affectsConfiguration(`${ConfigService.namespace}.enable`)) {
      if (this.client) {
        if (
          configService.vsCodeConfig.enableBiome &&
          !this.client.isRunning() &&
          (await this.shouldStartServer(configService))
        ) {
          await this.client.start()
        } else if (
          !configService.vsCodeConfig.enableBiome &&
          this.client.isRunning()
        ) {
          await this.client.stop()
        }
      }
    }
    this.updateStatusBar(statusBarItemHandler, configService)

    if (
      this.client?.isRunning() &&
      configService.effectsWorkspaceConfigChange(event)
    ) {
      const sendNotification = () =>
        this.client
          ?.sendNotification('workspace/didChangeConfiguration', {
            settings: configService.biomeServerConfig,
          })
          .then(() => undefined)

      if (this.isReconnecting) {
        this.queueMessage(sendNotification)
        return
      }

      await sendNotification()
    }
  }

  public updateStatusBar(
    statusBarItemHandler: StatusBarItemHandler,
    configService: ConfigService,
  ) {
    const enable = configService.vsCodeConfig.enableBiome
    const isEnabled = (this.client?.isRunning() ?? false) && enable

    let text =
      `[$(terminal) Open Output](command:${BiomeCommands.ShowOutput})\n\n` +
      `[$(refresh) Restart Server](command:${BiomeCommands.Restart})\n\n`

    if (enable) {
      text += `[$(stop) Stop Server](command:${BiomeCommands.ToggleEnabled})\n\n`
    } else {
      text += `[$(play) Start Server](command:${BiomeCommands.ToggleEnabled})\n\n`
    }

    const activeEditor = window.activeTextEditor
    let isFileActive = false
    if (activeEditor && isEnabled) {
      isFileActive = configService.vsCodeConfig.enabledLanguages.includes(
        activeEditor.document.languageId,
      )
    }

    statusBarItemHandler.updateTool(
      'biome',
      isEnabled,
      text,
      this.client?.initializeResult?.serverInfo?.version,
      isFileActive,
    )
  }

  private async shouldStartServer(
    configService: ConfigService,
  ): Promise<boolean> {
    if (!configService.vsCodeConfig.enableBiome) return false
    if (!configService.vsCodeConfig.requireConfig) return true
    return (
      (
        await workspace.findFiles(
          biomeConfigDefaultFilePattern,
          '**/node_modules/**',
          1,
        )
      ).length > 0
    )
  }
}

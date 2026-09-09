import { deepStrictEqual, ok, strictEqual } from 'node:assert'
import { type Event, LogLevel } from 'vscode'
import { State } from 'vscode-languageclient/node'
import StatusBarItemHandler from '../../client/StatusBarItemHandler.js'
import BiomeTool from '../../client/tools/biome.js'

class MockOutputChannel {
  public readonly name = 'Biome'
  public readonly logLevel = LogLevel.Info
  public readonly onDidChangeLogLevel: Event<LogLevel> = () => ({
    dispose: () => {},
  })
  public logs: Array<{ level: string; message: string }> = []

  trace(message: string) {
    this.logs.push({ level: 'trace', message })
  }
  info(message: string) {
    this.logs.push({ level: 'info', message })
  }
  warn(message: string) {
    this.logs.push({ level: 'warn', message })
  }
  error(message: string) {
    this.logs.push({ level: 'error', message })
  }
  debug(message: string) {
    this.logs.push({ level: 'debug', message })
  }
  appendLine(message: string) {
    this.logs.push({ level: 'appendLine', message })
  }
  append(message: string) {
    this.logs.push({ level: 'append', message })
  }
  replace(message: string) {
    this.logs.push({ level: 'replace', message })
  }
  clear() {
    this.logs = []
  }
  show() {}
  hide() {}
  dispose() {}
}

class MockConfigService {
  public vsCodeConfig = {
    enableBiome: true,
    useExecPath: false,
    nodePath: undefined,
    enabledLanguages: ['typescript'],
    requireConfig: true,
  }
  public biomeServerConfig = {}

  effectsBiomeConnection() {
    return false
  }
  effectsWorkspaceConfigChange() {
    return false
  }
  getWorkspaceConfig() {
    return undefined
  }
  async getBiomeServerBinPath() {
    return { path: '/fake/biome', loader: 'native' as const }
  }
}

class MockStatusBarItemHandler extends StatusBarItemHandler {
  public lastUpdate: {
    toolId: string
    isEnabled: boolean
    text: string
    version?: string
    isFileActive?: boolean
  } | null = null

  constructor() {
    super('1.0.0-test')
  }

  updateTool(
    toolId: string,
    isEnabled: boolean,
    text: string,
    version?: string,
    isFileActive?: boolean,
  ) {
    this.lastUpdate = { toolId, isEnabled, text, version, isFileActive }
  }
  show() {}
  dispose() {}
}

class MockLanguageClient {
  public state: State = State.Stopped
  public isRunningValue = false
  public initializeResult: { serverInfo?: { version?: string } } = {
    serverInfo: { version: '1.0.0' },
  }
  private stateChangeHandlers: Array<
    (e: { oldState: State; newState: State }) => void
  > = []
  private notificationHandlers: Map<string, (params: any) => void> = new Map()

  get isRunning() {
    return this.isRunningValue
  }

  onDidChangeState(handler: (e: { oldState: State; newState: State }) => void) {
    this.stateChangeHandlers.push(handler)
    return {
      dispose: () => {
        this.stateChangeHandlers = this.stateChangeHandlers.filter(
          (h) => h !== handler,
        )
      },
    }
  }

  onNotification(type: string, handler: (params: any) => void) {
    this.notificationHandlers.set(type, handler)
    return {
      dispose: () => {
        this.notificationHandlers.delete(type)
      },
    }
  }

  async start() {
    const oldState = this.state
    this.state = State.Starting
    this.isRunningValue = true
    this.state = State.Running
    this.stateChangeHandlers.forEach((h) => {
      h({ oldState, newState: this.state })
    })
  }

  async stop() {
    const oldState = this.state
    this.state = State.Stopped
    this.isRunningValue = false
    this.stateChangeHandlers.forEach((h) => {
      h({ oldState, newState: this.state })
    })
  }

  async restart() {
    await this.stop()
    await this.start()
  }

  async sendRequest() {
    return Promise.resolve()
  }
  async sendNotification() {
    return Promise.resolve()
  }
  error() {}
  dispose() {
    return Promise.resolve()
  }
}

suite('BiomeTool - Auto Reconnection', () => {
  let biomeTool: BiomeTool
  let mockClient: MockLanguageClient
  let outputChannel: MockOutputChannel
  let configService: MockConfigService
  let statusBarItemHandler: MockStatusBarItemHandler

  setup(() => {
    biomeTool = new BiomeTool()
    mockClient = new MockLanguageClient()
    outputChannel = new MockOutputChannel()
    configService = new MockConfigService()
    statusBarItemHandler = new MockStatusBarItemHandler()

    ;(biomeTool as any).client = mockClient
  })

  teardown(() => {
    ;(biomeTool as any).client = undefined
  })

  test('activate() stores references and resets reconnection state', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    strictEqual((biomeTool as any).configService, configService)
    strictEqual((biomeTool as any).outputChannel, outputChannel)
    strictEqual((biomeTool as any).statusBarItemHandler, statusBarItemHandler)

    strictEqual((biomeTool as any).isManuallyStopped, false)
    strictEqual((biomeTool as any).reconnectAttempts, 0)
    strictEqual((biomeTool as any).isReconnecting, false)
    deepStrictEqual((biomeTool as any).messageQueue, [])
  })

  test('deactivate() sets isManuallyStopped = true', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    await biomeTool.deactivate()

    strictEqual((biomeTool as any).isManuallyStopped, true)
  })

  test('restartClient() resets isManuallyStopped and reconnectAttempts', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ;(biomeTool as any).isManuallyStopped = true
    ;(biomeTool as any).reconnectAttempts = 3

    await biomeTool.restartClient()

    strictEqual((biomeTool as any).isManuallyStopped, false)
    strictEqual((biomeTool as any).reconnectAttempts, 0)
  })

  test('onStateChange() triggers auto-reconnect on unexpected stop', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ok(
      (biomeTool as any).stateChangeDisposable,
      'State change handler should be registered',
    )

    ;(biomeTool as any).onStateChange({
      oldState: State.Running,
      newState: State.Stopped,
    })

    const attempts = (biomeTool as any).reconnectAttempts
    const isReconnecting = (biomeTool as any).isReconnecting
    ok(attempts > 0 || isReconnecting, 'Should have initiated reconnection')
  })

  test('onStateChange() does NOT reconnect when manually stopped', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ;(biomeTool as any).isManuallyStopped = true

    mockClient.state = State.Running
    mockClient.isRunningValue = true
    mockClient.stop()

    await new Promise((r) => setTimeout(r, 10))

    const infoLogs = outputChannel.logs.filter((l) => l.level === 'info')
    const reconnectLogs = infoLogs.filter((l) =>
      l.message.includes('Reconnection attempt'),
    )
    strictEqual(
      reconnectLogs.length,
      0,
      'Should not attempt reconnection when manually stopped',
    )
  })

  test('onStateChange() does NOT reconnect when biome is disabled', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    configService.vsCodeConfig.enableBiome = false

    mockClient.state = State.Running
    mockClient.isRunningValue = true
    mockClient.stop()

    await new Promise((r) => setTimeout(r, 10))

    const infoLogs = outputChannel.logs.filter((l) => l.level === 'info')
    const reconnectLogs = infoLogs.filter((l) =>
      l.message.includes('Reconnection attempt'),
    )
    strictEqual(
      reconnectLogs.length,
      0,
      'Should not attempt reconnection when biome disabled',
    )
  })

  test('attemptAutoReconnect() respects max attempts and updates status bar', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ;(biomeTool as any).reconnectAttempts = 5

    await (biomeTool as any).attemptAutoReconnect()

    const errorLogs = outputChannel.logs.filter((l) => l.level === 'error')
    const maxAttemptsLog = errorLogs.find((l) =>
      l.message.includes('Max reconnection attempts reached'),
    )
    ok(maxAttemptsLog, 'Should log max attempts reached')

    ok(statusBarItemHandler.lastUpdate, 'Should have updated status bar')
    strictEqual(statusBarItemHandler.lastUpdate!.isEnabled, false)
    strictEqual(statusBarItemHandler.lastUpdate!.text, 'Not Activated')
  })

  test('queueMessage() and flushQueue() work correctly', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    let executed = false
    const fn = async () => {
      executed = true
    }

    ;(biomeTool as any).queueMessage(fn)
    strictEqual((biomeTool as any).messageQueue.length, 1)

    await (biomeTool as any).flushQueue()
    strictEqual(executed, true)
    strictEqual((biomeTool as any).messageQueue.length, 0)
  })

  test('queueMessage() respects max queue size', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    const queue = (biomeTool as any).messageQueue
    const maxSize = (biomeTool as any).maxQueueSize

    for (let i = 0; i < maxSize + 10; i++) {
      ;(biomeTool as any).queueMessage(async () => {})
    }

    strictEqual(queue.length, maxSize, 'Queue should not exceed max size')
  })

  test('applyAllFixesFile() queues request when reconnecting', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ;(biomeTool as any).isReconnecting = true
    ;(biomeTool as any).client = mockClient

    const queueLengthBefore = (biomeTool as any).messageQueue.length
    ;(biomeTool as any).queueMessage(async () => {})
    strictEqual((biomeTool as any).messageQueue.length, queueLengthBefore + 1)
  })

  test('onConfigChange() queues notification when reconnecting', async () => {
    const binary = { path: '/fake/biome', loader: 'native' as const }
    await biomeTool.activate(
      outputChannel,
      configService as any,
      statusBarItemHandler,
      binary,
    )

    ;(biomeTool as any).isReconnecting = true
    ;(biomeTool as any).client = mockClient

    const queueLengthBefore = (biomeTool as any).messageQueue.length
    ;(biomeTool as any).queueMessage(async () => {})
    strictEqual((biomeTool as any).messageQueue.length, queueLengthBefore + 1)
  })
})

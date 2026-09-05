import {
  commands,
  type ExtensionContext,
  type LogOutputChannel,
  window,
  workspace,
} from 'vscode'
import { ConfigManager } from './ConfigManager'
import { ConfigService } from './ConfigService'
import { ConfigWebview } from './ConfigWebview'
import {
  BiomeCommands,
  copyDebugCommand,
  fixProjectCommand,
  fixProjectUnsafeCommand,
  formatProjectCommand,
  openConfigCommand,
  rageCommand,
} from './commands'
import StatusBarItemHandler from './StatusBarItemHandler'
import BiomeTool from './tools/biome'
import type ToolInterface from './tools/ToolInterface'

const outputChannelName = 'Biome'
const tools: ToolInterface[] = []

tools.push(new BiomeTool())

const restartTool = async (
  tool: ToolInterface,
  outputChannel: LogOutputChannel,
  configService: ConfigService,
  statusBarItemHandler: StatusBarItemHandler,
) => {
  try {
    await tool.deactivate()
    const newBinaryPath = await tool.getBinary(outputChannel, configService)
    await tool.activate(
      outputChannel,
      configService,
      statusBarItemHandler,
      newBinaryPath,
    )
  } catch (e) {
    outputChannel.error(`Failed to restart tool, error: ${e instanceof Error ? e.message : String(e)}.
    Try to restart the editor manually.
    `)
  }
}

export async function activate(context: ExtensionContext) {
  const configManager = new ConfigManager(context.globalState)
  const configService = new ConfigService()

  const outputChannel = window.createOutputChannel(outputChannelName, {
    log: true,
  })

  const statusBarItemHandler = new StatusBarItemHandler(
    context.extension.packageJSON?.version,
  )

  const biomeTool =
    tools.find((tool): tool is BiomeTool => tool instanceof BiomeTool) ??
    (tools[0] as BiomeTool)

  type CommandHandler = (...args: unknown[]) => unknown

  const COMMAND_REGISTRATIONS: {
    id: BiomeCommands
    handler: CommandHandler
  }[] = [
    { id: BiomeCommands.ShowOutput, handler: () => outputChannel.show() },
    {
      id: BiomeCommands.Restart,
      handler: () =>
        restartTool(
          biomeTool,
          outputChannel,
          configService,
          statusBarItemHandler,
        ),
    },
    {
      id: BiomeCommands.ToggleEnabled,
      handler: () =>
        configService.vsCodeConfig.updateEnableBiome(
          !configService.vsCodeConfig.enableBiome,
        ),
    },
    {
      id: BiomeCommands.ApplyAllFixes,
      handler: () => biomeTool.applyAllFixesFile(),
    },
    {
      id: BiomeCommands.FormatProject,
      handler: async () =>
        formatProjectCommand(
          await biomeTool.getBinary(outputChannel, configService),
          configService.vsCodeConfig,
        ),
    },
    {
      id: BiomeCommands.FixProject,
      handler: async () =>
        fixProjectCommand(
          await biomeTool.getBinary(outputChannel, configService),
          configService.vsCodeConfig,
        ),
    },
    {
      id: BiomeCommands.FixProjectUnsafe,
      handler: async () =>
        fixProjectUnsafeCommand(
          await biomeTool.getBinary(outputChannel, configService),
          configService.vsCodeConfig,
        ),
    },
    { id: BiomeCommands.OpenConfig, handler: () => openConfigCommand() },
    {
      id: BiomeCommands.CopyDebugInfo,
      handler: () =>
        copyDebugCommand(
          context.extension.packageJSON?.version ?? 'unknown',
          biomeTool.getLspVersion() ?? 'unknown',
          configService.vsCodeConfig,
        ),
    },
    {
      id: BiomeCommands.Rage,
      handler: async () =>
        rageCommand(
          await biomeTool.getBinary(outputChannel, configService),
          outputChannel,
          configService.vsCodeConfig,
        ),
    },
    {
      id: BiomeCommands.AddCustomConfig,
      handler: () =>
        ConfigWebview.render(context.extensionUri, configManager, 'editor'),
    },
    {
      id: BiomeCommands.SpawnConfig,
      handler: () =>
        ConfigWebview.render(context.extensionUri, configManager, 'picker'),
    },
    {
      id: BiomeCommands.OpenConfigManager,
      handler: () =>
        ConfigWebview.render(context.extensionUri, configManager, 'picker'),
    },
  ]

  const commandDisposables = COMMAND_REGISTRATIONS.map(({ id, handler }) =>
    commands.registerCommand(id, handler),
  )

  const onDidChangeWorkspaceFoldersDispose =
    workspace.onDidChangeWorkspaceFolders(async (event) => {
      for (const folder of event.added) {
        configService.addWorkspaceConfig(folder)
      }
      for (const folder of event.removed) {
        configService.removeWorkspaceConfig(folder)
      }
    })

  const onActiveEditorChangeDispose = window.onDidChangeActiveTextEditor(() => {
    biomeTool.updateStatusBar(statusBarItemHandler, configService)
  })

  context.subscriptions.push(
    ...commandDisposables,
    configService,
    outputChannel,
    onDidChangeWorkspaceFoldersDispose,
    onActiveEditorChangeDispose,
    statusBarItemHandler,
  )

  configService.onConfigChange = async function onConfigChange(event) {
    if (configService.vsCodeConfig.effectsBiomeConnection(event)) {
      outputChannel.info('biome connection changed, restarting biome tool.')
      await restartTool(
        biomeTool,
        outputChannel,
        configService,
        statusBarItemHandler,
      )
    } else {
      await Promise.all(
        tools.map((tool) =>
          tool.onConfigChange(event, configService, statusBarItemHandler),
        ),
      )
    }
  }

  outputChannel.info('Searching for biome binary.')

  try {
    const binaryPath = await biomeTool.getBinary(outputChannel, configService)
    await biomeTool.activate(
      outputChannel,
      configService,
      statusBarItemHandler,
      binaryPath,
    )
  } catch (e) {
    outputChannel.error(
      `Failed to activate biome tool: ${e instanceof Error ? e.message : String(e)}`,
    )
    statusBarItemHandler.updateTool(
      'biome',
      false,
      `Activation failed: ${e instanceof Error ? e.message : String(e)}`,
    )
  }

  statusBarItemHandler.show()
}

export async function deactivate(): Promise<void> {
  await Promise.all(tools.map((tool) => tool.deactivate()))
}

import type { ConfigurationChangeEvent, LogOutputChannel } from 'vscode'
import type { ConfigService } from '../ConfigService'
import type { BinarySearchResult } from '../findBinary'
import type StatusBarItemHandler from '../StatusBarItemHandler'

export default interface ToolInterface {
  getLspVersion(): string | undefined
  getBinary(
    outputChannel: LogOutputChannel,
    configService: ConfigService,
  ): Promise<BinarySearchResult | undefined>
  activate(
    outputChannel: LogOutputChannel,
    configService: ConfigService,
    statusBarItemHandler: StatusBarItemHandler,
    binary?: BinarySearchResult,
  ): Promise<void>

  deactivate(): Promise<void>

  onConfigChange(
    event: ConfigurationChangeEvent,
    configService: ConfigService,
    statusBarItemHandler: StatusBarItemHandler,
  ): Promise<void>
}

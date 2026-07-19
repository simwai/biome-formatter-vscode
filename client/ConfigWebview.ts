import * as fs from 'fs'
import * as path from 'path'
import * as vscode from 'vscode'
import type { ConfigManager, CustomConfig } from './ConfigManager'
import { Validator } from './Validator'

export class ConfigWebview {
  public static currentPanel: ConfigWebview | undefined
  private readonly _panel: vscode.WebviewPanel
  private readonly _extensionUri: vscode.Uri
  private _disposables: vscode.Disposable[] = []
  private _configManager: ConfigManager
  private _strictTemplate: string
  private _validator: Validator | undefined

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    configManager: ConfigManager,
  ) {
    this._panel = panel
    this._extensionUri = extensionUri
    this._configManager = configManager

    const templatePath = path.join(
      extensionUri.fsPath,
      'out',
      'strict_template.json',
    )
    this._strictTemplate = fs.readFileSync(
      fs.existsSync(templatePath)
        ? templatePath
        : path.join(extensionUri.fsPath, 'client', 'strict_template.json'),
      'utf8',
    )
    try {
      const schemaPath = path.join(extensionUri.fsPath, 'biome_schema.json')
      if (fs.existsSync(schemaPath)) {
        this._validator = new Validator(fs.readFileSync(schemaPath, 'utf8'))
      }
    } catch (e) {}

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview)
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables)

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'refresh':
            this.renderConfigs()
            break
          case 'editConfig':
            this.handleEditConfig(message.id, message.isDefault, message.isNew)
            break
          case 'saveConfig':
            await this.handleSaveConfig(message.config)
            break
          case 'spawn':
            await this.handleSpawn(message.config)
            break
          case 'validate':
            this.handleValidate(message.content)
            break
          case 'deleteConfig':
            await this.handleDeleteConfig(message.id)
            break
        }
      },
      null,
      this._disposables,
    )

    this.renderConfigs()
  }

  public static render(
    extensionUri: vscode.Uri,
    configManager: ConfigManager,
    view: 'picker' | 'editor' = 'picker',
  ) {
    if (ConfigWebview.currentPanel) {
      ConfigWebview.currentPanel._panel.reveal(vscode.ViewColumn.One)
    } else {
      const panel = vscode.window.createWebviewPanel(
        'biomeConfig',
        'Biome Config Manager',
        vscode.ViewColumn.One,
        {
          enableScripts: true,
          localResourceRoots: [extensionUri],
        },
      )
      ConfigWebview.currentPanel = new ConfigWebview(
        panel,
        extensionUri,
        configManager,
      )
    }

    if (view === 'editor') {
      ConfigWebview.currentPanel.handleEditConfig(
        Date.now().toString(),
        false,
        true,
      )
    }
  }

  private renderConfigs() {
    this._panel.webview.postMessage({
      command: 'renderConfigs',
      configs: this._configManager.getConfigs(),
      strictTemplate: this._strictTemplate,
    })
  }

  private handleEditConfig(
    id: string,
    isDefault: boolean,
    isNew: boolean = false,
  ) {
    let config: Partial<CustomConfig>
    if (isDefault) {
      config = {
        id: 'default',
        name: 'Strict Default Template',
        content: this._strictTemplate,
      }
    } else {
      const existing = this._configManager.getConfigs().find((c) => c.id === id)
      if (existing) {
        config = existing
      } else if (isNew) {
        config = {
          id,
          name: this._configManager.generateNextUntitledName(),
          content: this._strictTemplate,
          updatedAt: Date.now(),
        }
      } else {
        return
      }
    }
    this._panel.webview.postMessage({
      command: 'openEditor',
      config,
      isDefault,
    })
  }

  private async handleDeleteConfig(id: string) {
    const confirm = await vscode.window.showWarningMessage(
      'Delete this configuration?',
      { modal: true },
      'Delete',
      'Cancel',
    )
    if (confirm !== 'Delete') return
    await this._configManager.deleteConfig(id)
    this.renderConfigs()
  }

  private async handleSaveConfig(config: CustomConfig) {
    config.updatedAt = Date.now()
    if (!config.name || config.name.trim() === '') {
      config.name = 'Untitled'
    }
    await this._configManager.saveConfig(config)
  }

  private async handleSpawn(config: { name: string; content: string }) {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) {
      vscode.window.showErrorMessage('No workspace folder open.')
      return
    }

    const rootPath = workspaceFolders[0].uri.fsPath
    const configPath = path.join(rootPath, 'biome.json')

    if (fs.existsSync(configPath)) {
      const answer = await vscode.window.showWarningMessage(
        `A biome.json already exists in ${rootPath}. Overwrite?`,
        { modal: true },
        'Yes',
        'No',
      )
      if (answer !== 'Yes') return
    }

    try {
      fs.writeFileSync(configPath, config.content)
      vscode.window.showInformationMessage(`Spawned biome.json successfully!`)
      const doc = await vscode.workspace.openTextDocument(
        vscode.Uri.file(configPath),
      )
      await vscode.window.showTextDocument(doc)
    } catch (err) {
      vscode.window.showErrorMessage(
        `Failed to spawn config: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  private handleValidate(content: string) {
    const errors = this._validator ? this._validator.validate(content) : []
    this._panel.webview.postMessage({ command: 'validationResult', errors })
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const htmlPath = path.join(
      this._extensionUri.fsPath,
      'client',
      'webview',
      'index.html',
    )
    const html = fs.readFileSync(htmlPath, 'utf8')
    return html
  }

  public dispose() {
    ConfigWebview.currentPanel = undefined
    this._panel.dispose()
    while (this._disposables.length) {
      const x = this._disposables.pop()
      if (x) {
        x.dispose()
      }
    }
  }
}

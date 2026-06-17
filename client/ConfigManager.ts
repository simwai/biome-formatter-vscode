import type { Memento } from 'vscode'

export interface CustomConfig {
  id: string
  name: string
  content: string
  updatedAt: number
}

export class ConfigManager {
  private static readonly STORAGE_KEY = 'biome.customConfigs'

  constructor(private readonly storage: Memento) {}

  public getConfigs(): CustomConfig[] {
    return this.storage.get<CustomConfig[]>(ConfigManager.STORAGE_KEY, [])
  }

  public async saveConfig(config: CustomConfig): Promise<void> {
    const configs = this.getConfigs()
    const index = configs.findIndex((c) => c.id === config.id)
    if (index !== -1) {
      configs[index] = config
    } else {
      configs.push(config)
    }
    await this.storage.update(ConfigManager.STORAGE_KEY, configs)
  }

  public async deleteConfig(id: string): Promise<void> {
    const configs = this.getConfigs()
    const filtered = configs.filter((c) => c.id !== id)
    await this.storage.update(ConfigManager.STORAGE_KEY, filtered)
  }

  public generateNextUntitledName(): string {
    const configs = this.getConfigs()
    let i = 1
    let name = 'Untitled'
    while (configs.some((c) => c.name === name)) {
      name = `Untitled ${i++}`
    }
    return name
  }
}

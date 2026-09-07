import { strictEqual } from 'node:assert'
import { workspace } from 'vscode'
import { WorkspaceConfig } from '../../client/WorkspaceConfig.js'
import { WORKSPACE_FOLDER } from '../test-helpers.js'

const keys = ['lint.run', 'configPath', 'disableNestedConfig']

// biome-ignore lint/style/noNonNullAssertion: tests always open tests/unit per .vscode-test.mjs workspaceFolder
const FOLDER = WORKSPACE_FOLDER!

suite('WorkspaceConfig', () => {
  const updateConfiguration = async (key: string, value: unknown) => {
    const workspaceConfig = workspace.getConfiguration('biome', FOLDER)
    await workspaceConfig.update(key, value)
  }

  setup(async () => {
    await Promise.all(keys.map((key) => updateConfiguration(key, undefined)))
  })

  teardown(async () => {
    await Promise.all(keys.map((key) => updateConfiguration(key, undefined)))
  })

  test('default values on initialization', () => {
    const config = new WorkspaceConfig(FOLDER)
    strictEqual(config.runTrigger, 'onSave')
    strictEqual(config.configPath, null)
    strictEqual(config.disableNestedConfig, false)
  })

  test('refresh correctly populates properties from configuration', async () => {
    const config = new WorkspaceConfig(FOLDER)
    await updateConfiguration('lint.run', 'onType')
    await updateConfiguration('configPath', './custom-biome.json')
    await updateConfiguration('disableNestedConfig', true)

    config.refresh()

    strictEqual(config.runTrigger, 'onType')
    strictEqual(config.configPath, './custom-biome.json')
    strictEqual(config.disableNestedConfig, true)
  })

  test('toBiomeConfig method', () => {
    const config = new WorkspaceConfig(FOLDER)
    const biomeConfig = config.toBiomeConfig()
    strictEqual(biomeConfig.run, 'onSave')
    strictEqual(biomeConfig.configPath, null)
    strictEqual(biomeConfig.disableNestedConfig, false)
  })
})

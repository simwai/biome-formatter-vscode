import { strictEqual } from 'node:assert'
import StatusBarItemHandler from '../../client/StatusBarItemHandler.js'

suite('StatusBarItemHandler', () => {
  test('constructor does not throw', () => {
    const handler = new StatusBarItemHandler('1.0.0')
    strictEqual(typeof handler, 'object')
    handler.dispose()
  })

  test('updateTool handles enabled state', () => {
    const handler = new StatusBarItemHandler('1.0.0')
    handler.updateTool('biome', true, 'Biome v1.0.0', '1.0.0')
    handler.show()
    handler.dispose()
  })

  test('updateTool handles disabled state', () => {
    const handler = new StatusBarItemHandler('1.0.0')
    handler.updateTool('biome', false, 'Disabled', undefined, false)
    handler.dispose()
  })

  test('dispose is idempotent', () => {
    const handler = new StatusBarItemHandler('1.0.0')
    handler.dispose()
    handler.dispose()
  })
})

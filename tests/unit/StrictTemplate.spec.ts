import { doesNotThrow, ok } from 'node:assert'
import * as fs from 'node:fs'
import * as path from 'node:path'

suite('Strict Template', () => {
  test('should exist in out directory', () => {
    const templatePath = path.resolve(process.cwd(), 'out/strict_template.json')
    ok(fs.existsSync(templatePath), 'strict_template.json should exist in out/')
  })

  test('should be valid JSON', () => {
    const templatePath = path.resolve(process.cwd(), 'out/strict_template.json')
    const content = fs.readFileSync(templatePath, 'utf8')
    doesNotThrow(
      () => JSON.parse(content),
      'strict_template.json should be valid JSON',
    )
  })
})

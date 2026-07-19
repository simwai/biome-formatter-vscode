import { ok, strictEqual } from 'node:assert'
import { runExecutable } from '../../client/tools/lsp_helper.js'

suite('lsp_helper', () => {
  test('runExecutable creates a valid Executable', () => {
    const binary = { path: '/path/to/biome', loader: 'native' as const }
    const executable = runExecutable(binary, false)
    ok(executable.command.includes('/path/to/biome'))
    strictEqual(executable.args.length, 1)
    strictEqual(executable.args[0], 'lsp-proxy')
  })
})

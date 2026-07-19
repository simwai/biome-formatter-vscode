import { strictEqual } from 'node:assert'
import * as path from 'node:path'
import {
  replaceTargetFromMainToBin,
  validateSafeBinaryPath,
} from '../../client/findBinary.js'

suite('findBinary', () => {
  test('replaceTargetFromMainToBin finds bin from @biomejs/biome package.json', () => {
    const packageJsonPath = path.resolve(
      __dirname,
      '../../node_modules/.pnpm/@biomejs+biome@2.4.13/node_modules/@biomejs/biome/package.json',
    )
    const binPath = replaceTargetFromMainToBin(packageJsonPath, 'biome')
    strictEqual(binPath.endsWith(`bin${path.sep}biome`), true)
  })
})

suite('findBinary validateSafeBinaryPath', () => {
  test('valid biome paths', () => {
    strictEqual(validateSafeBinaryPath('/usr/local/bin/biome'), true)
    strictEqual(validateSafeBinaryPath('C:\\biome.exe'), true)
    strictEqual(validateSafeBinaryPath('./biome'), true)
  })

  test('case insensitive biome check', () => {
    strictEqual(validateSafeBinaryPath('BIOME_LANGUAGE_SERVER'), true)
    strictEqual(validateSafeBinaryPath('Biome'), true)
  })

  test('rejects path traversal', () => {
    strictEqual(validateSafeBinaryPath('../biome'), false)
    strictEqual(validateSafeBinaryPath('../../biome'), false)
  })

  test('rejects malicious characters', () => {
    strictEqual(validateSafeBinaryPath('biome;ls'), false)
    strictEqual(validateSafeBinaryPath('biome|cat'), false)
    strictEqual(validateSafeBinaryPath('biome$PATH'), false)
    strictEqual(validateSafeBinaryPath('biome>out'), false)
    strictEqual(validateSafeBinaryPath('biome<input'), false)
    strictEqual(validateSafeBinaryPath('biome`whoami`'), false)
    strictEqual(validateSafeBinaryPath('biome&'), false)
    strictEqual(validateSafeBinaryPath('bio\rme'), false)
  })

  test('rejects paths without biome in name', () => {
    strictEqual(validateSafeBinaryPath('/usr/local/bin/node'), false)
    strictEqual(validateSafeBinaryPath('/opt/myapp'), false)
    strictEqual(validateSafeBinaryPath(''), false)
  })
})

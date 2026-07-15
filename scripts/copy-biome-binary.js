const fs = require('node:fs')
const path = require('node:path')

const platform = process.platform
const arch = process.arch

const PLATFORM_BINARY = {
  win32: {
    x64: '@biomejs/cli-win32-x64/biome.exe',
    arm64: '@biomejs/cli-win32-arm64/biome.exe',
  },
  darwin: {
    x64: '@biomejs/cli-darwin-x64/biome',
    arm64: '@biomejs/cli-darwin-arm64/biome',
  },
  linux: {
    x64: '@biomejs/cli-linux-x64/biome',
    arm64: '@biomejs/cli-linux-arm64/biome',
  },
}

const binarySuffix = PLATFORM_BINARY[platform]?.[arch]
if (!binarySuffix) {
  console.error(`Unsupported platform: ${platform}-${arch}`)
  process.exit(1)
}

const biomePkgPath = require.resolve('@biomejs/biome/package.json')
const biomePkgDir = path.dirname(biomePkgPath)
// binarySuffix is like '@biomejs/cli-win32-x64/biome.exe'
// Parts: ['@biomejs', 'cli-win32-x64', 'biome.exe']
const parts = binarySuffix.split('/')
const binaryName = parts[2]
// The sibling package dir is at the same scope level as @biomejs/biome
const scopeDir = path.dirname(biomePkgDir)
const sourcePath = path.join(scopeDir, parts[1], binaryName)

if (!fs.existsSync(sourcePath)) {
  console.error(`Biome binary not found at: ${sourcePath}`)
  process.exit(1)
}

const outDir = path.resolve(__dirname, '..', 'out', 'biome-bin')
fs.mkdirSync(outDir, { recursive: true })

const destPath = path.join(outDir, binaryName)
fs.copyFileSync(sourcePath, destPath)
fs.chmodSync(destPath, 0o755)

console.log(`Copied biome binary: ${sourcePath} -> ${destPath}`)

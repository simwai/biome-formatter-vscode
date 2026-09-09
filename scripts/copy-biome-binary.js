const fs = require('node:fs')
const path = require('node:path')

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

function copyAllPlatformBinaries() {
  const biomePkgPath = require.resolve('@biomejs/biome/package.json')
  const biomePkgDir = path.dirname(biomePkgPath)
  // why: the cli packages are siblings of the biome package under the same scope.
  const scopeDir = path.dirname(biomePkgDir)
  const outBase = path.resolve(__dirname, '..', 'out', 'biome-bin')

  let copied = 0
  let skipped = 0
  for (const [platform, arches] of Object.entries(PLATFORM_BINARY)) {
    for (const [arch, binarySuffix] of Object.entries(arches)) {
      // binarySuffix is like '@biomejs/cli-win32-x64/biome.exe'
      // Parts: ['@biomejs', 'cli-win32-x64', 'biome.exe']
      const parts = binarySuffix.split('/')
      const binaryName = parts[2]
      const sourcePath = path.join(scopeDir, parts[1], binaryName)
      if (!fs.existsSync(sourcePath)) {
        // biome-ignore lint/suspicious/noConsole: build script
        console.warn(`Skipping unavailable biome binary: ${sourcePath}`)
        skipped++
        continue
      }
      const outDir = path.join(outBase, `${platform}-${arch}`)
      fs.mkdirSync(outDir, { recursive: true })
      const destPath = path.join(outDir, binaryName)
      fs.copyFileSync(sourcePath, destPath)
      fs.chmodSync(destPath, 0o755)
      // biome-ignore lint/suspicious/noConsole: build script
      console.log(`Copied biome binary: ${sourcePath} -> ${destPath}`)
      copied++
    }
  }

  // why: older lookups expect the flat path, so keep writing it alongside the subdirs.
  const hostSuffix = PLATFORM_BINARY[process.platform]?.[process.arch]
  if (hostSuffix) {
    const parts = hostSuffix.split('/')
    const binaryName = parts[2]
    const hostSub = path.join(
      outBase,
      `${process.platform}-${process.arch}`,
      binaryName,
    )
    if (fs.existsSync(hostSub)) {
      const flatDest = path.join(outBase, binaryName)
      fs.copyFileSync(hostSub, flatDest)
      fs.chmodSync(flatDest, 0o755)
    }
  }

  if (copied === 0) {
    // biome-ignore lint/suspicious/noConsole: build script
    console.error('No biome binaries found to bundle.')
    process.exit(1)
  }
  // biome-ignore lint/suspicious/noConsole: build script
  console.log(`Bundled ${copied} biome binaries (${skipped} skipped).`)
}

copyAllPlatformBinaries()

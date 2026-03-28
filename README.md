# Biome Formatter

Biome is a high-performance toolchain for web projects, providing a fast formatter and a linter for JavaScript, TypeScript, and more.

## Installation

Install through the VS Code extensions marketplace by searching for `Biome Formatter`. Verify the identifier is `simwai.biome-vscode`.

## Features

- High-performance formatting and linting.
- Support for `biome.json` and `biome.jsonc`.
- Unified LSP connection.
- Command to fix all auto-fixable content.
- Support for multi-root workspaces.

## Configuration

To enable it as your default formatter, use a VS Code `settings.json` like:

```json
{
  "editor.defaultFormatter": "simwai.biome-vscode",
  "editor.formatOnSave": true
}
```

## Settings

- `biome.enable`: Enable or disable the extension.
- `biome.lint.run`: Run the linter on save or on type.
- `biome.requireConfig`: Start the server only when a config file exists.
- `biome.configPath`: Custom path to biome configuration.
- `biome.path.biome`: Custom path to a Biome binary.

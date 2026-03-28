# ⚓ Biome

Biome is creating a suite of high-performance tools for JavaScript and TypeScript.

## Installation

Any of the below options can be used to install the extension.

- Install through the VS Code extensions marketplace by searching for `Biome`. Verify the identifier is `simwai.biome-vscode`.
- From within VS Code, open the Quick Open (Ctrl+P or Cmd+P on macOS) and execute `ext install simwai.biome-vscode`.

## Biome

This is the linter for Biome. The currently supported features are listed below.

- Highlighting for warnings or errors identified by Biome
- Quick fixes to fix a warning or error when possible
- JSON schema validation for supported Biome configuration files (does not include ESLint configuration files)
- Command to fix all auto-fixable content within the current text editor.
- Support for `source.fixAll.biome` as a code action provider. Configure this in your settings `editor.codeActionsOnSave`
  to automatically apply fixes when saving the file.
- Support for multi-root workspaces.
- Support for type-aware linting when the `biome-tsgolint` package is installed and the `biome.typeAware` setting is set to true.

## Biome

This is the formatter for Biome. The currently supported features are listed below.

- Support for `source.format.biome` as a code action provider.

To enable it as your default formatter, use a VS Code `settings.json` like:

```json
{
  "editor.defaultFormatter": "simwai.biome-vscode",
  "editor.formatOnSave": true,
  "editor.formatOnSaveMode": "file" // tell biome to format the whole file, not only the modified lines
  // Or enable it for specific file types:
  // "[javascript]": {
  //   "editor.defaultFormatter": "simwai.biome-vscode"
  // },
}
```

To run Biome formatting through VS Code code actions on save, configure `editor.codeActionsOnSave`:

```json
{
  "editor.codeActionsOnSave": {
    "source.format.biome": "always"
  }
}
```

Running formatting as a code action on save, allows to define the order of changes when both formatting and lint fixes are applied on save. For example, the below configuration will run the formatter first, and then apply lint fixes:

```json
{
  "editor.defaultFormatter": "simwai.biome-vscode",
  "editor.formatOnSave": false, // disable default behavior
  "editor.codeActionsOnSave": {
    "source.format.biome": "always", // run formatter first
    "source.fixAll.biome": "always" // run lint fixes after
  }
}
```

## Configuration

<!-- START_GENERATED_CONFIGURATION -->

### Window Configuration

Following configurations are supported via `settings.json` and affect the window editor:

| Key                         | Default Value | Possible Values                  | Description                                                                                                                                                                                                                                                                        |
| --------------------------- | ------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `biome.enable`                | `null`        | `true` \| `false` \| `<null>`    | This is a master toggle for both `biome.enable.biome` and `biome.enable.biome`.                                                                                                                                                                                                       |
| `biome.enable.biome`          | `true`        | `true` \| `false`                | Enable biome (formatter). Falls back to `biome.enable` if not set.                                                                                                                                                                                                                   |
| `biome.enable.biome`         | `true`        | `true` \| `false`                | Enable biome (linter). Falls back to `biome.enable` if not set.                                                                                                                                                                                                                     |
| `biome.path.node`             | -             | `<string>`                       | Path to a Node.js binary. Will be added to the `biome` and `biome` `PATH` environment.                                                                                                                                                                                            |
| `biome.path.biome`            | -             | `<string>`                       | Path to an Biome formatter binary. Default: auto detection in `node_modules`.                                                                                                                                                                                                        |
| `biome.path.biome`           | -             | `<string>`                       | Path to an Biome linter binary. Default: auto detection in `node_modules`.                                                                                                                                                                                                           |
| `biome.path.tsgolint`         | -             | `<string>`                       | Path to an Biome tsgolint binary. Default: auto detection from `biome`.                                                                                                                                                                                                             |
| `biome.suppressProgramErrors` | `false`       | `true` \| `false`                | Suppress tsconfig errors from tsgolint and still lint files under partially-valid tsconfig projects. When enabled, sets `OXLINT_TSGOLINT_DANGEROUSLY_SUPPRESS_PROGRAM_DIAGNOSTICS=true`. **Note:** Type-aware lint rules may produce degraded results when the tsconfig is broken. |
| `biome.trace.server`          | `off`         | `off` \| `messages` \| `verbose` | Traces the communication between VS Code and the language server.                                                                                                                                                                                                                  |
| `biome.useExecPath`           | `false`       | `true` \| `false`                | Whether to use the extension's execPath (Electron's bundled Node.js) as the JavaScript runtime for running Biome tools, instead of looking for a system Node.js installation.                                                                                                        |
| Deprecated                  |               |                                  |                                                                                                                                                                                                                                                                                    |
| `biome.path.server`           | -             | `<string>`                       | Path to Biome language server binary. Mostly for testing the language server.                                                                                                                                                                                                        |

### Workspace Configuration

Following configurations are supported via `settings.json` and can be changed for each workspace:

| Key                           | Default Value | Possible Values                                                                                               | Description                                                                                                                                                                                                                            |
| ----------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `biome.configPath`              | `null`        | `<string>` \| `<null>`                                                                                        | Path to biome configuration. Keep it empty to enable nested configuration.                                                                                                                                                            |
| `biome.disableNestedConfig`     | `false`       | `true` \| `false`                                                                                             | Disable searching for nested configuration files. When set to true, only the configuration file specified in `biome.configPath` (if any) will be used.                                                                                   |
| `biome.fixKind`                 | `safe_fix`    | `safe_fix` \| `safe_fix_or_suggestion` \| `dangerous_fix` \| `dangerous_fix_or_suggestion` \| `none` \| `all` | Specify the kind of fixes to suggest/apply.                                                                                                                                                                                            |
| `biome.fmt.configPath`          | `null`        | `<string>` \| `<null>`                                                                                        | Path to an biome configuration file                                                                                                                                                                                                    |
| `biome.lint.run`                | `onType`      | `onSave` \| `onType`                                                                                          | Run the linter on save (onSave) or on type (onType)                                                                                                                                                                                    |
| `biome.requireConfig`           | `false`       | `true` \| `false`                                                                                             | Start the language server only when a `.biomerc.json(c)` or `biome.config.ts` file exists in one of the workspaces.                                                                                                                  |
| `biome.tsConfigPath`            | `null`        | `<string>` \| `<null>`                                                                                        | Path to the project's TypeScript config file. If your `tsconfig.json` is not at the root, you will need this set for the `import` plugin rules to resolve imports correctly.                                                           |
| `biome.typeAware`               | `null`        | `true` \| `false` \| `<null>`                                                                                 | Forces type-aware linting. Requires the `biome-tsgolint` package. It is preferred to use `options.typeAware` in your configuration file                                                                                               |
| `biome.unusedDisableDirectives` | `null`        | `allow` \| `warn` \| `deny`                                                                                   | Define how directive comments like `// biome-disable-line` should be reported, when no errors would have been reported on that line anyway. It is preferred to use `options.reportUnusedDisableDirectives` in your configuration file |
| Deprecated                    |               |                                                                                                               |                                                                                                                                                                                                                                        |
| `biome.flags`                   | `{}`          | `Record<string, string>`                                                                                      | Specific Biome flags to pass to the language server.                                                                                                                                                                                  |
| `biome.fmt.experimental`        | `true`        | `true` \| `false`                                                                                             | Enable Biome formatting support.                                                                                                                                                                                                       |

#### FixKind

- `"safe_fix"` (default)
- `"safe_fix_or_suggestion"`
- `"dangerous_fix"`
- `"dangerous_fix_or_suggestion"`
- `"none"`
- `"all"`

<!-- END_GENERATED_CONFIGURATION -->

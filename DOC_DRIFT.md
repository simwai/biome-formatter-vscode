# Documentation Drift Report

**Date/Time:** 2025-05-14
**Branch Analyzed:** `jules-2453254468306476007-e55274ee`

## Files Reviewed

- `README.md`
- `CONTRIBUTING.md`
- `package.json`
- `client/commands.ts`
- `client/VSCodeConfig.ts`
- `CHANGELOG.md`

## Regressions Found

- **Missing Commands:** `Biome: Add Custom Config` and `Biome: Spawn Config` were present in `package.json` and implemented in `client/extension.ts` but missing from `README.md`.
- **Incomplete Command Descriptions:** `Biome: Open Biome Configuration` in `README.md` only mentioned `biome.json`, while the implementation in `client/commands.ts` and `package.json` supports `.jsonc`, `.biome.json`, and `.biome.jsonc`.
- **Stale Settings Information:** `README.md` lacked default value information for `biome.configPath` and `biome.path.biome`, and the description for `biome.useExecPath` was less detailed than in `package.json`.
- **Outdated Clone URL:** `CONTRIBUTING.md` listed `https://github.com/simwai/biome-vscode.git` as the clone URL, but the actual repository is `https://github.com/simwai/biome-formatter-vscode.git`.

## Fixes Made

- **README.md:**
    - Added `Biome: Add Custom Config` and `Biome: Spawn Config` to the Commands section.
    - Updated `Biome: Open Biome Configuration` to include all supported configuration file types.
    - Added missing default values and refined descriptions for `biome.configPath`, `biome.path.biome`, and `biome.useExecPath`.
- **CONTRIBUTING.md:**
    - Updated the repository clone URL and directory name.

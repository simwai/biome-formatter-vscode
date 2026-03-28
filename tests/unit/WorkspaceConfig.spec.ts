import { strictEqual } from "node:assert";
import { workspace } from "vscode";
import { WorkspaceConfig } from "../../client/WorkspaceConfig.js";

suite("WorkspaceConfig", () => {
  test("refresh correctly populates properties from configuration", async () => {
    const config = new WorkspaceConfig(workspace.workspaceFolders![0]);
    const wsConfig = workspace.getConfiguration("biome", workspace.workspaceFolders![0]);

    await wsConfig.update("lint.run", "onSave");
    await wsConfig.update("configPath", "./custom-biome.json");
    await wsConfig.update("disableNestedConfig", true);

    config.refresh();

    strictEqual(config.runTrigger, "onSave");
    strictEqual(config.configPath, "./custom-biome.json");
    strictEqual(config.disableNestedConfig, true);
  });
});

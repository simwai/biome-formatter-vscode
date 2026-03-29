import { strictEqual } from "node:assert";
import { workspace } from "vscode";
import { VSCodeConfig } from "../../client/VSCodeConfig.js";

suite("VSCodeConfig", () => {
	test("refresh correctly populates properties from configuration", async () => {
		const config = new VSCodeConfig();
		const wsConfig = workspace.getConfiguration("biome");

		await wsConfig.update("enable", false);
		await wsConfig.update("trace.server", "verbose");
		await wsConfig.update("path.biome", "./biome");
		await wsConfig.update("path.node", "./node");
		await wsConfig.update("useExecPath", true);
		await wsConfig.update("requireConfig", true);

		config.refresh();

		strictEqual(config.enableBiome, false);
		strictEqual(config.trace, "verbose");
		strictEqual(config.binPathBiome, "./biome");
		strictEqual(config.nodePath, "./node");
		strictEqual(config.useExecPath, true);
		strictEqual(config.requireConfig, true);
	});
});

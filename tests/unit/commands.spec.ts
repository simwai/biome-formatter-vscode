import { strictEqual } from "node:assert";
import { BiomeCommands } from "../../client/commands.js";

suite("commands", () => {
	test("command names are correct", () => {
		strictEqual(BiomeCommands.ShowOutputChannelLint, "biome.showOutputChannel");
		strictEqual(BiomeCommands.RestartServerLint, "biome.restartServer");
		strictEqual(BiomeCommands.ToggleEnableLint, "biome.toggleEnable");
		strictEqual(BiomeCommands.ApplyAllFixesFile, "biome.applyAllFixesFile");
		strictEqual(BiomeCommands.CopyDebugInfo, "biome.copyDebugInfo");
	});
});

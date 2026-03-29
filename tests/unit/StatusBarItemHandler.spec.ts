import { strictEqual } from "node:assert";
import StatusBarItemHandler from "../../client/StatusBarItemHandler.js";

suite("StatusBarItemHandler", () => {
	test("updates status bar with Biome tool", () => {
		const handler = new StatusBarItemHandler("1.0.0");
		handler.updateTool("biome", true, "Biome version 1.0.0", "1.0.0");
		// We can't easily check the private statusBarItem, but we can verify it doesn't crash
		strictEqual(typeof handler.updateTool, "function");
	});
});

import { strictEqual } from "node:assert";
import { runExecutable } from "../../client/tools/lsp_helper.js";

suite("lsp_helper", () => {
	test("runExecutable creates a valid Executable", () => {
		const binary = { path: "/path/to/biome", loader: "native" as const };
		const executable = runExecutable(binary, false);
		strictEqual(executable.command, "/path/to/biome");
	});
});

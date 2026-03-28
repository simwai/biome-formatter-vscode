import { strictEqual } from "assert";
import { validateSafeBinaryPath } from "../../client/PathValidator";

suite("validateSafeBinaryPath", () => {
  test("should return true for valid binary paths", () => {
    strictEqual(validateSafeBinaryPath("/usr/local/bin/biome_language_server"), true);
    strictEqual(validateSafeBinaryPath("C:\\Program Files\\biome_language_server.exe"), true);
    strictEqual(validateSafeBinaryPath("./biome_language_server"), true);
    strictEqual(validateSafeBinaryPath("/opt/biome_language_server"), true);
  });

  test("should accept case variations of biome_language_server", () => {
    strictEqual(validateSafeBinaryPath("BIOME_LANGUAGE_SERVER"), true);
    strictEqual(validateSafeBinaryPath("BIOME_LANGUAGE_SERVER.exe"), true);
    strictEqual(validateSafeBinaryPath("/usr/local/bin/BIOME_LANGUAGE_SERVER"), true);
    strictEqual(validateSafeBinaryPath("C:\\Program Files\\BIOME_LANGUAGE_SERVER.exe"), true);
  });

  test("should reject paths with directory traversal", () => {
    strictEqual(validateSafeBinaryPath("../biome_language_server"), false);
    strictEqual(validateSafeBinaryPath("../../biome_language_server"), false);
    strictEqual(validateSafeBinaryPath("/usr/local/../bin/biome_language_server"), false);
    strictEqual(validateSafeBinaryPath("..\\biome_language_server"), false);
    strictEqual(validateSafeBinaryPath(".\\biome_language_server"), false);
  });

  test("should reject paths with malicious characters", () => {
    strictEqual(validateSafeBinaryPath("biome_language_server;rm -rf /"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server|cat /etc/passwd"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server$PATH"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server>output.txt"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server<input.txt"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server`whoami`"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server!"), false);

    // windows specific
    strictEqual(validateSafeBinaryPath("biome_language_server^&pause"), false);
    strictEqual(validateSafeBinaryPath("biome_language_server & del /f *"), false);
  });
});

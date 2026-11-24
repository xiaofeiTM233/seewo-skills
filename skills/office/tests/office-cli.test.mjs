import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const pythonRoot = join(repository, ".desktop-runtime-cache/document-processing", `${process.platform}-${process.arch}`, "python");
const python = process.platform === "win32" ? join(pythonRoot, "python.exe") : join(pythonRoot, "bin/python3.12");
const skill = fileURLToPath(new URL("..", import.meta.url));

test("prepared Python reads Office and exports auditable assets from a relocated Skill", { skip: !existsSync(python) && "Run pnpm documents:runtime:prepare" }, async (t) => {
	const root = await mkdtemp(join(tmpdir(), "office-skill-中文 "));
	t.after(() => rm(root, { recursive: true, force: true }));
	const relocated = join(root, "office");
	await cp(skill, relocated, { recursive: true });
	const result = spawnSync(python, ["-I", "-B", join(relocated, "tests/office_cli_fixture.py")], { timeout: 60000, windowsHide: true });
	assert.ifError(result.error);
	assert.equal(result.status, 0, result.stdout.toString("utf8") + result.stderr.toString("utf8"));
});

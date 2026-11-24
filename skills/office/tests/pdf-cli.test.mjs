import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, truncate, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { preparePdfjsPackage } from "../../../apps/desktop/scripts/document-runtime-pdfjs.mjs";
import { chinesePdfFixture, unusualMappingPdfFixture } from "./pdf-fixture.mjs";

const pdfjsSource = dirname(createRequire(import.meta.url).resolve("pdfjs-dist/package.json"));

test("relocated PDF script reads CJK maps and reports limits without system dependencies", async (t) => {
	const temp = await mkdtemp(join(tmpdir(), "pdf-中文 #% "));
	t.after(() => rm(temp, { recursive: true, force: true }));
	const runtime = join(temp, "运行时 #% 空格");
	await mkdir(runtime);
	const info = await preparePdfjsPackage(runtime, "6.3.289", pdfjsSource);
	const root = join(runtime, info.root), entry = join(root, info.entry);
	const skill = join(temp, "复制 技能 #%");
	await mkdir(skill);
	const script = join(skill, "read_pdf.mjs");
	await cp(fileURLToPath(new URL("../scripts/read_pdf.mjs", import.meta.url)), script);
	const input = join(temp, "中文 样本 #%.pdf");
	await writeFile(input, chinesePdfFixture());
	const sourceSha = createHash("sha256").update(await readFile(input)).digest("hex");
	const environment = { PATH: "" };
	for (const key of ["SystemRoot", "WINDIR", "TEMP", "TMP"]) {
		if (process.env[key]) environment[key] = process.env[key];
	}
	const invoke = (...args) => spawnSync(process.execPath, [script, "--input", input, "--pdfjs-entry", entry, "--pdfjs-root", root, ...args], {
		cwd: temp, env: environment, encoding: "utf8", timeout: 30_000, windowsHide: true,
	});
	const all = invoke();
	assert.ifError(all.error);
	assert.equal(all.status, 0, all.stderr);
	const result = JSON.parse(all.stdout);
	assert.equal(result.units[0].text, "你好中文");
	assert.equal(result.source.sha256, sourceSha);
	assert.equal(result.units[1].textStatus, "no_text");
	assert.equal(result.coverage.totalPages, 2);
	assert.deepEqual(result.coverage.processed, [{ kind: "pages", pages: [1, 2] }]);
	assert.equal(result.partial, true);
	assert(result.warnings.some((warning) => warning.code === "NO_TEXT_LAYER" && warning.location.page === 2));
	const limited = invoke("--pages", "1", "--max-text-chars", "2");
	assert.equal(limited.status, 0, limited.stderr);
	const partial = JSON.parse(limited.stdout);
	assert.equal(partial.units[0].text, "你好");
	assert(partial.warnings.some((warning) => warning.code === "LIMIT_REACHED"));
	assert.equal(partial.partial, true);
	const output = join(temp, "输出 #%.json");
	const saved = invoke("--pages", "1", "--output", output);
	assert.equal(saved.status, 0, saved.stderr);
	assert.equal(JSON.parse(saved.stdout).partial, false);
	assert.equal(JSON.parse(await readFile(output, "utf8")).units[0].text, "你好中文");
	const relativeOutput = "相对 输出 #%.json";
	const relativeResult = spawnSync(process.execPath, [script, "--input", "中文 样本 #%.pdf", "--pdfjs-entry", entry, "--pdfjs-root", root, "--pages", "1", "--output", relativeOutput], {
		cwd: temp, env: environment, encoding: "utf8", timeout: 30_000, windowsHide: true,
	});
	assert.equal(relativeResult.status, 0, relativeResult.stderr);
	assert.equal(JSON.parse(relativeResult.stdout).ok, true);
	assert.equal(JSON.parse(await readFile(join(temp, relativeOutput), "utf8")).units[0].text, "你好中文");
	assert.equal(createHash("sha256").update(await readFile(input)).digest("hex"), sourceSha);
	const unusual = join(temp, "不寻常映射.pdf");
	await writeFile(unusual, unusualMappingPdfFixture());
	const mapped = spawnSync(process.execPath, [script, "--input", unusual, "--pdfjs-entry", entry, "--pdfjs-root", root], {
		cwd: temp, env: environment, encoding: "utf8", timeout: 30_000, windowsHide: true,
	});
	assert.equal(mapped.status, 0, mapped.stderr);
	const mappedResult = JSON.parse(mapped.stdout);
	assert.equal(mappedResult.units[0].text, "A\uE000\u0001");
	assert(mappedResult.warnings.some((warning) => warning.code === "TEXT_MAPPING_UNCERTAIN"));
	const existing = invoke("--pages", "1", "--output", output);
	assert.notEqual(existing.status, 0);
	assert.equal(JSON.parse(await readFile(output, "utf8")).units[0].text, "你好中文");
	for (const selection of ["1,1", "0", "3"]) {
		const bad = invoke("--pages", selection);
		assert.notEqual(bad.status, 0);
		assert.match(bad.stderr, /"code":"INVALID_ARGUMENT"/);
	}
	const huge = join(temp, "large.pdf");
	await writeFile(huge, "");
	await truncate(huge, 256 * 1024 * 1024 + 1);
	const oversized = spawnSync(process.execPath, [script, "--input", huge, "--pdfjs-entry", entry, "--pdfjs-root", root], { encoding: "utf8", windowsHide: true });
	assert.notEqual(oversized.status, 0);
	const error = JSON.parse(oversized.stderr);
	assert.equal(error.operation, "read");
	assert.equal(error.error.code, "INPUT_TOO_LARGE");
	assert.match(error.error.message, /268435457.*268435456/);
});

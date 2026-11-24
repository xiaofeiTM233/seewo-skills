import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkHtml } from "../scripts/lib/check.mjs";
import { uploadImage, boundedRequest, PUBLIC_CSTORE } from "../scripts/lib/upload.mjs";

const png = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6vGAAAAAASUVORK5CYII=",
	"base64",
);
const html = (content) => `<!doctype html><html><head><title>Demo</title></head><body>${content}</body></html>`;
async function workspace(t) {
	const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), "interactive-webpage-")));
	t.after(() => fs.rm(root, { recursive: true, force: true }));
	return root;
}
function network({ policy = {}, upload, probe } = {}) {
	const calls = [];
	return {
		calls,
		fetchImpl: async (url, options) => {
			calls.push({ url, options });
			assert.equal(options.credentials, "omit");
			assert.equal(options.redirect, "error");
			if (url === PUBLIC_CSTORE.policyUrl)
				return Response.json({
					code: 0,
					data: {
						uploadUrl: "https://new-storage.example/upload",
						formFields: [{ key: "x:appid", value: "fixture" }],
						headerFields: [],
						...policy,
					},
				});
			if (options.method === "POST") {
				assert.equal(options.body.get("x:appid"), "fixture");
				assert.equal(options.body.get("file").type, "image/png");
				assert.deepEqual(Buffer.from(await options.body.get("file").arrayBuffer()), png);
				return upload
					? upload()
					: Response.json({
							code: 0,
							data: { fileSize: png.length, downloadUrl: "https://new-cdn.example/image.png" },
						});
			}
			return probe ? probe() : new Response(png, { headers: { "content-type": "image/png" } });
		},
	};
}

test("check reads final HTML directly, accepts public and embedded resources, and does not write or execute", async (t) => {
	const root = await workspace(t);
	const content = html(
		`<link rel="stylesheet" href="https://cdn.example/a.css"><img src="https://cdn.example/a.png"><img src="data:image/png;base64,${png.toString("base64")}"><style>body{background:url(https://cdn.example/b.png)}</style><script>throw new Error('must not execute'); fetch('https://api.example');</script><button onclick="return 1 &lt; 2">Go</button><textarea><img src="asset:example"></textarea>`,
	);
	await fs.writeFile(path.join(root, "index.html"), content);
	const result = await checkHtml("index.html", { workspace: root });
	assert.equal(result.staticChecks, "passed");
	assert.equal(result.inlineScripts, 1);
	assert.equal(result.browserInteraction, "not-verified");
	assert.equal(await fs.readFile(path.join(root, "index.html"), "utf8"), content);
	assert.deepEqual(await fs.readdir(root), ["index.html"]);
});

test("check reports external and module scripts as unverified without blocking them", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(
		path.join(root, "index.html"),
		html('<script src="https://cdn.example/a.js"></script><script type="module">export const x = 1;</script>'),
	);
	const result = await checkHtml("index.html", { workspace: root });
	assert.deepEqual(result.warnings, ["EXTERNAL_SCRIPT_NOT_CHECKED", "MODULE_SCRIPT_NOT_CHECKED"]);
});

test("check rejects malformed documents, invalid JS/JSON and unresolved image placeholders", async (t) => {
	const root = await workspace(t);
	for (const [content, code] of [
		["<p>fragment</p>", "HTML_DOCUMENT_REQUIRED"],
		[html("<script>const = 1;</script>"), "SCRIPT_SYNTAX_INVALID"],
		[html('<button onclick="const = 1">Go</button>'), "SCRIPT_SYNTAX_INVALID"],
		[html('<script type="application/json">{bad}</script>'), "SCRIPT_JSON_INVALID"],
		[html('<img src="asset:hero">'), "ASSET_PLACEHOLDER_UNRESOLVED"],
		[html('<style>body{background:url("asset:hero")}</style>'), "ASSET_PLACEHOLDER_UNRESOLVED"],
		[html('<img src="x" src="y">'), "HTML_ATTRIBUTE_DUPLICATE"],
	]) {
		await fs.writeFile(path.join(root, "index.html"), content);
		await assert.rejects(checkHtml("index.html", { workspace: root }), { code });
	}
});

test("file checks preserve workspace boundaries, reject links and oversized input", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(path.join(root, "index.html"), html("ready"));
	await fs.symlink(path.join(root, "index.html"), path.join(root, "link.html"));
	for (const file of ["../outside.html", "link.html"])
		await assert.rejects(checkHtml(file, { workspace: root }), { code: "PATH_REJECTED" });
	assert.equal((await checkHtml(path.join(root, "index.html"), { workspace: root })).staticChecks, "passed");
	await fs.writeFile(path.join(root, "large.html"), html(`<!--${"a".repeat(9 * 1024 * 1024)}-->`));
	assert.equal((await checkHtml("large.html", { workspace: root })).staticChecks, "passed");
	await fs.truncate(path.join(root, "large.html"), 100 * 1024 * 1024 + 1);
	await assert.rejects(checkHtml("large.html", { workspace: root }), { code: "FILE_TOO_LARGE" });
});

test("upload needs only an image file, returns a directly usable URL, and creates no manifests", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(path.join(root, "photo.png"), png);
	const net = network();
	const result = await uploadImage("photo.png", { workspace: root, fetchImpl: net.fetchImpl });
	assert.equal(result.url, "https://new-cdn.example/image.png");
	assert.equal(result.verification, "passed");
	assert.equal(net.calls.length, 3);
	assert.deepEqual(await fs.readdir(root), ["photo.png"]);
});

test("invalid images and policies stop before uploading", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(path.join(root, "photo.png"), Buffer.from("not an image"));
	const net = network();
	await assert.rejects(uploadImage("photo.png", { workspace: root, fetchImpl: net.fetchImpl }), {
		code: "IMAGE_INVALID",
	});
	assert.equal(net.calls.length, 0);
	await fs.writeFile(path.join(root, "photo.png"), png);
	for (const policy of [
		{ uploadUrl: "http://store.example" },
		{ uploadUrl: "https://user:password@store.example" },
		{ needCallServer: true },
	]) {
		const fake = network({ policy });
		await assert.rejects(uploadImage("photo.png", { workspace: root, fetchImpl: fake.fetchImpl }));
		assert.equal(fake.calls.length, 1);
	}
});

test("uncertain uploads are reported without automatic retry; explicit rejection is distinct", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(path.join(root, "photo.png"), png);
	for (const [upload, code] of [
		[
			() => {
				throw new Error("disconnect");
			},
			"UPLOAD_RESULT_UNKNOWN",
		],
		[() => new Response("broken", { status: 200 }), "UPLOAD_RESULT_UNKNOWN"],
		[() => new Response("down", { status: 500 }), "UPLOAD_RESULT_UNKNOWN"],
		[() => new Response("denied", { status: 403 }), "ACCESS_DENIED"],
		[() => Response.json({ code: 1 }), "UPLOAD_FAILED"],
	]) {
		const net = network({ upload });
		await assert.rejects(uploadImage("photo.png", { workspace: root, fetchImpl: net.fetchImpl }), { code });
		assert.equal(net.calls.filter((call) => call.options.method === "POST").length, 1);
	}
});

test("successful upload retains URL when anonymous verification fails", async (t) => {
	const root = await workspace(t);
	await fs.writeFile(path.join(root, "photo.png"), png);
	const net = network({ probe: () => new Response("unavailable", { status: 503 }) });
	const result = await uploadImage("photo.png", { workspace: root, fetchImpl: net.fetchImpl });
	assert.equal(result.verification, "PUBLIC_URL_UNAVAILABLE");
	assert.equal(result.url, "https://new-cdn.example/image.png");
	assert.equal(net.calls.length, 3);
});

test("network reads remain bounded and cancellable", async () => {
	await assert.rejects(
		boundedRequest("https://example.com", {}, { maximum: 2, fetchImpl: async () => new Response("too long") }),
		{ code: "RESPONSE_TOO_LARGE" },
	);
	const controller = new AbortController();
	controller.abort();
	await assert.rejects(
		boundedRequest(
			"https://example.com",
			{},
			{
				signal: controller.signal,
				fetchImpl: async (_url, options) => {
					options.signal.throwIfAborted();
				},
			},
		),
	);
});

test("CLI runs from installed path with spaces, exposes only upload/check, rejects legacy commands", async (t) => {
	const root = await workspace(t);
	const installed = path.join(root, "skill with spaces");
	await fs.cp(fileURLToPath(new URL("../scripts", import.meta.url)), installed, { recursive: true });
	const invoke = (args) =>
		spawnSync(process.execPath, [path.join(installed, "webpage.mjs"), ...args], { cwd: root, encoding: "utf8" });
	assert.deepEqual(JSON.parse(invoke(["--help"]).stdout).commands, ["upload-image", "check"]);
	for (const command of ["init", "draft", "build", "commit", "history", "restore", "add-image"]) {
		const result = invoke([command]);
		assert.equal(result.status, 1);
		assert.equal(JSON.parse(result.stdout).error, "COMMAND_UNKNOWN");
	}
	await fs.writeFile(path.join(root, "index.html"), html("<script>const value = 1;</script>"));
	const result = invoke(["check", "--file", "index.html"]);
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).staticChecks, "passed");
	assert.equal(invoke(["check", "--file", "index.html", "--version", "old"]).status, 1);
});

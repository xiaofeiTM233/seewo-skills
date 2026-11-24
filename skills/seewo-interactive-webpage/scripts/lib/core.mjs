import { constants } from "node:fs";
import * as fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

export const LIMITS = Object.freeze({
	image: 20 * 1024 ** 2,
	html: 100 * 1024 ** 2,
	networkJson: 128 * 1024,
	output: 16 * 1024,
});
export class WebpageError extends Error {
	constructor(code) {
		super(code);
		this.code = code;
	}
}
export function requireThat(condition, code) {
	if (!condition) throw new WebpageError(code);
}
export const digest = (value) => createHash("sha256").update(value).digest("hex");
export function record(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function relative(value) {
	requireThat(
		typeof value === "string" &&
			value.length > 0 &&
			value.length < 1024 &&
			!value.includes("\\") &&
			!value.includes("\0") &&
			!path.isAbsolute(value) &&
			value.split("/").every((part) => part && part !== "." && part !== ".."),
		"PATH_REJECTED",
	);
	return value;
}
const rootIdentities = new Map();
async function assertRoot(root) {
	const info = await fs.lstat(root).catch(() => {
		throw new WebpageError("ROOT_CHANGED");
	});
	requireThat(info.isDirectory() && !info.isSymbolicLink() && (await fs.realpath(root)) === root, "ROOT_CHANGED");
	const previous = rootIdentities.get(root);
	if (previous) requireThat(previous.dev === info.dev && previous.ino === info.ino, "ROOT_CHANGED");
	else rootIdentities.set(root, { dev: info.dev, ino: info.ino });
}
async function guard(root, rel) {
	await assertRoot(root);
	relative(rel);
	const parts = rel.split("/");
	let cursor = root;
	for (let i = 0; i < parts.length; i++) {
		cursor = path.join(cursor, parts[i]);
		const info = await fs.lstat(cursor);
		requireThat(!info.isSymbolicLink() && (i === parts.length - 1 || info.isDirectory()), "PATH_REJECTED");
	}
	return cursor;
}
export async function read(root, rel, maximum = LIMITS.html) {
	const handle = await fs.open(await guard(root, rel), constants.O_RDONLY | constants.O_NOFOLLOW);
	try {
		await assertRoot(root);
		const stat = await handle.stat();
		requireThat(stat.nlink !== 0, "FILE_GONE");
		requireThat(stat.nlink === 1, "PATH_REJECTED");
		requireThat(stat.isFile() && stat.size <= maximum, "FILE_TOO_LARGE");
		// Read at most one byte past the bound even if another process grows the file.
		const bytes = Buffer.alloc(stat.size + 1);
		let size = 0;
		while (size < bytes.length) {
			const result = await handle.read(bytes, size, bytes.length - size, size);
			if (!result.bytesRead) break;
			size += result.bytesRead;
		}
		const finalStat = await handle.stat();
		requireThat(finalStat.nlink !== 0, "FILE_GONE");
		requireThat(finalStat.nlink === 1, "PATH_REJECTED");
		requireThat(size === stat.size && finalStat.size === stat.size, "FILE_CHANGED");
		await assertRoot(root);
		return bytes.subarray(0, size);
	} finally {
		await handle.close();
	}
}
// Resolve the workspace alias once; individual input paths still reject symlinks.
export async function readInput(workspace, file, maximum) {
	const root = await fs.realpath(workspace);
	requireThat(typeof file === "string", "FILE_REQUIRED");
	const base = path.isAbsolute(file) && file.startsWith(`${root}${path.sep}`) ? root : path.resolve(workspace);
	const rel = path.isAbsolute(file) ? path.relative(base, file) : file;
	return read(root, rel.split(path.sep).join("/"), maximum);
}

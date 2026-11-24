#!/usr/bin/env node
// Read only the PDF text layer. Visual content and text inside images need a separate visual inspection.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile, realpath, stat, writeFile } from "node:fs/promises";
import { extname, isAbsolute, join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";

const LIMITS = { maxUnits: 2000, maxTextChars: 2_000_000, maxInputBytes: 256 * 1024 * 1024 };
const usage = `Read the PDF text layer without OCR.\n\n` +
	`--input <file> --pdfjs-entry <file> --pdfjs-root <directory>\n` +
	`[--pages 1,3-5] [--max-units 1-2000] [--max-text-chars 1-2000000] [--output <new.json>]\n` +
	`Input limit: 256 MiB; output limits default to 2000 pages and 2000000 UTF-16 units.`;

class Failure extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

function argumentsFrom(argv) {
	const values = {};
	const accepted = new Set(["input", "pdfjs-entry", "pdfjs-root", "pages", "max-units", "max-text-chars", "output"]);
	if (argv.length === 1 && argv[0] === "--help") {
		process.stdout.write(`${usage}\n`);
		return undefined;
	}
	for (let index = 0; index < argv.length; index += 2) {
		const name = argv[index]?.startsWith("--") ? argv[index].slice(2) : "";
		const value = argv[index + 1];
		if (!accepted.has(name) || Object.hasOwn(values, name) || !value || value.startsWith("--"))
			throw new Failure("INVALID_ARGUMENT", `Invalid argument: ${argv[index] ?? ""}.`);
		values[name] = value;
	}
	if (!values.input || !values["pdfjs-entry"] || !values["pdfjs-root"])
		throw new Failure("INVALID_ARGUMENT", "--input, --pdfjs-entry and --pdfjs-root are required.");
	if (!isAbsolute(values["pdfjs-entry"]) || !isAbsolute(values["pdfjs-root"]))
		throw new Failure("INVALID_ARGUMENT", "PDF.js entry and root must be absolute paths from load_workspace_dependencies.");
	return {
		input: values.input,
		entry: values["pdfjs-entry"],
		root: values["pdfjs-root"],
		pages: values.pages === undefined ? undefined : parsePages(values.pages),
		maxUnits: bounded(values["max-units"], LIMITS.maxUnits),
		maxTextChars: bounded(values["max-text-chars"], LIMITS.maxTextChars),
		output: values.output,
	};
}

function bounded(value, max) {
	if (value === undefined) return max;
	if (!/^[0-9]+$/.test(value)) throw new Failure("INVALID_ARGUMENT", `Limit must be between 1 and ${max}.`);
	const result = Number(value);
	if (!Number.isSafeInteger(result) || result < 1 || result > max)
		throw new Failure("INVALID_ARGUMENT", `Limit must be between 1 and ${max}.`);
	return result;
}

function parsePages(value) {
	const result = [];
	for (const part of value.split(",")) {
		const match = /^(\d+)(?:-(\d+))?$/.exec(part);
		if (!match) throw new Failure("INVALID_ARGUMENT", "Use distinct 1-based pages, e.g. 1,3-5.");
		const first = Number(match[1]);
		const last = Number(match[2] ?? match[1]);
		if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last - first + result.length >= LIMITS.maxUnits)
			throw new Failure("INVALID_ARGUMENT", "Page selection is invalid or exceeds 2000 pages.");
		for (let page = first; page <= last; page++) result.push(page);
	}
	if (new Set(result).size !== result.length) throw new Failure("INVALID_ARGUMENT", "Page selection contains duplicates.");
	return result;
}

function within(root, path) {
	const rel = relative(root, path);
	return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}

// PDF.js requires directory URLs ending in '/'. URL-based reading also handles
// Windows drive letters, Unicode, spaces, '#' and '%' without mixing separators.
function resourceFactory(root) {
	const directories = Object.fromEntries(
		[["cMapUrl", "cmaps"], ["standardFontDataUrl", "standard_fonts"], ["wasmUrl", "wasm"]].map(
			([kind, name]) => [kind, pathToFileURL(`${join(root, name)}${sep}`)],
		),
	);
	class LocalBinaryDataFactory {
		async fetch({ kind, filename }) {
			if (!Object.hasOwn(directories, kind) || !/^[a-zA-Z0-9._-]+$/.test(filename) || filename === "." || filename === "..")
				throw new Error("INVALID_PDF_RESOURCE");
			return new Uint8Array(await readFile(new URL(filename, directories[kind])));
		}
	}
	return { directories, LocalBinaryDataFactory };
}

async function digest(path) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(path)) hash.update(chunk);
	return hash.digest("hex");
}

function sameFile(a, b) {
	return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs;
}

function prefix(text, maximum) {
	let result = text.slice(0, maximum);
	if (result && /[\uD800-\uDBFF]/u.test(result.at(-1))) result = result.slice(0, -1);
	return result;
}

async function main(args) {
	const sourcePath = await realpath(args.input);
	if (extname(sourcePath).toLowerCase() !== ".pdf") throw new Failure("UNSUPPORTED_FORMAT", "Input must be a PDF.");
	const before = await stat(sourcePath);
	if (!before.isFile()) throw new Failure("INVALID_INPUT", "Input must be a regular file.");
	if (before.size > LIMITS.maxInputBytes) throw new Failure("INPUT_TOO_LARGE", `Input is ${before.size} bytes; limit is ${LIMITS.maxInputBytes} bytes.`);
	const bytes = await readFile(sourcePath);
	if (!sameFile(before, await stat(sourcePath))) throw new Failure("SOURCE_CHANGED", "Input changed during reading.");
	const hash = createHash("sha256").update(bytes).digest("hex");
	let root, entry;
	try {
		[root, entry] = await Promise.all([realpath(args.root), realpath(args.entry)]);
	} catch {
		throw new Failure("ENGINE_UNAVAILABLE", "Product PDF.js entry or package root is unavailable.");
	}
	if (!within(root, entry) || relative(root, entry).split(sep).join("/") !== "legacy/build/pdf.mjs")
		throw new Failure("ENGINE_UNAVAILABLE", "PDF.js entry is outside the declared package root.");
	const { directories, LocalBinaryDataFactory } = resourceFactory(root);
	let pdfjs;
	try {
		pdfjs = await import(pathToFileURL(entry).href);
	} catch {
		throw new Failure("ENGINE_UNAVAILABLE", "Product PDF.js entry could not be loaded.");
	}
	const task = pdfjs.getDocument({
		data: new Uint8Array(bytes),
		cMapUrl: directories.cMapUrl.href,
		standardFontDataUrl: directories.standardFontDataUrl.href,
		wasmUrl: directories.wasmUrl.href,
		cMapPacked: true,
		BinaryDataFactory: LocalBinaryDataFactory,
		useWorkerFetch: false,
		useSystemFonts: false,
		disableFontFace: true,
		isEvalSupported: false,
		stopAtErrors: true,
		verbosity: 0,
	});
	const units = [], warnings = [], omissions = [], processed = [];
	let totalPages;
	try {
		const pdf = await task.promise;
		totalPages = pdf.numPages;
		if (args.pages?.some((page) => page > totalPages))
			throw new Failure("INVALID_ARGUMENT", `Selected page exceeds total page count ${totalPages}.`);
		const selected = args.pages ?? Array.from({ length: Math.min(totalPages, args.maxUnits + 1) }, (_, index) => index + 1);
		const pages = selected.slice(0, args.maxUnits);
		if (pages.length < selected.length || (!args.pages && totalPages > pages.length)) {
			warnings.push({ code: "LIMIT_REACHED", message: "The page limit was reached." });
			omissions.push({ reason: "limit" });
		}
		let remaining = args.maxTextChars;
		for (const [index, number] of pages.entries()) {
			const page = await pdf.getPage(number);
			const location = { kind: "page", page: number };
			try {
				const content = await page.getTextContent();
				const text = content.items.filter((item) => "str" in item).map((item) => item.str + (item.hasEOL ? "\n" : "")).join("");
				if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u2E80-\u2FDF\uFFFD\p{Co}]/u.test(text))
					warnings.push({ code: "TEXT_MAPPING_UNCERTAIN", message: "Unusual control or character mappings may affect reading; inspect the page visually if needed.", location });
				if (!text.trim()) {
					warnings.push({ code: "NO_TEXT_LAYER", message: "No text was extracted from this page; it may be blank or contain visual-only content.", location });
					omissions.push({ reason: "text_unavailable", location });
				}
				const boundedText = prefix(text, remaining);
				units.push({ kind: "text", location, text: boundedText, textStatus: text.trim() ? "text" : "no_text" });
				processed.push(number);
				remaining -= boundedText.length;
				if (boundedText.length < text.length || (remaining <= 0 && index < pages.length - 1)) {
					warnings.push({ code: "LIMIT_REACHED", message: "The text limit was reached.", location });
					omissions.push({ reason: "limit", location });
					break;
				}
			} finally {
				page.cleanup();
			}
		}
	} finally {
		await task.destroy();
	}
	if (!sameFile(before, await stat(sourcePath)) || (await digest(sourcePath)) !== hash || !sameFile(before, await stat(sourcePath)))
		throw new Failure("SOURCE_CHANGED", "Input changed during processing; the result was discarded.");
	const result = {
		schemaVersion: 1, ok: true, operation: "read", format: "pdf",
		source: { path: sourcePath, bytes: before.size, sha256: hash },
		sourceFact: "SHA-256 describes the current input container, not a Host authorization or conversion history.",
		coverage: {
			...(args.pages ? { requested: { kind: "pages", pages: args.pages } } : {}),
			processed: processed.length ? [{ kind: "pages", pages: processed }] : [], omissions,
			layer: "PDF text layer", exclusions: ["text in images and other visual-only content"], totalPages,
		},
		partial: omissions.length > 0, warnings, units,
		limits: { maxUnits: args.maxUnits, maxTextChars: args.maxTextChars, maxInputBytes: LIMITS.maxInputBytes },
	};
	if (args.output) {
		await writeFile(args.output, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
		process.stdout.write(`${JSON.stringify({ ok: true, file: (await realpath(args.output)), partial: result.partial })}\n`);
	} else process.stdout.write(`${JSON.stringify(result)}\n`);
}

try {
	const args = argumentsFrom(process.argv.slice(2));
	if (args) await main(args);
} catch (error) {
	const code = error instanceof Failure ? error.code : error?.name === "PasswordException" ? "PASSWORD_PROTECTED" : error?.name === "InvalidPDFException" ? "INVALID_DOCUMENT" : "PROCESSING_FAILED";
	process.stderr.write(`${JSON.stringify({ ok: false, operation: "read", error: { code, message: error instanceof Error ? error.message : String(error) } })}\n`);
	process.exitCode = 1;
}

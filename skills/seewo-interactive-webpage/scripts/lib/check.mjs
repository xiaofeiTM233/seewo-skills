import vm from "node:vm";
import { LIMITS, readInput, requireThat, WebpageError } from "./core.mjs";

const decodeAttribute = (value) =>
	value.replace(/&(?:#(x[\da-f]+|\d+)|(amp|quot|apos|lt|gt));/gi, (_, numeric, named) =>
		numeric
			? String.fromCodePoint(Number.parseInt(numeric.replace(/^x/i, ""), /^x/i.test(numeric) ? 16 : 10))
			: { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" }[named.toLowerCase()],
	);

function tagAt(source, start) {
	let quote = "";
	for (let index = start + 1; index < source.length; index++) {
		const character = source[index];
		if (quote) {
			if (character === quote) quote = "";
		} else if (character === '"' || character === "'") quote = character;
		else if (character === ">") return source.slice(start, index + 1);
	}
	throw new WebpageError("HTML_TAG_INVALID");
}
function parseTag(raw) {
	const match = /^<([a-z][\w:-]*)([\s\S]*?)\/?\s*>$/i.exec(raw);
	requireThat(match, "HTML_TAG_INVALID");
	const attributes = [];
	const seen = new Set();
	let text = match[2];
	while (text.trim()) {
		const item = /^\s+([^\s=<>/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s<>"'`=]+)))?/.exec(text);
		requireThat(item, "HTML_ATTRIBUTE_INVALID");
		const name = item[1].toLowerCase();
		requireThat(!seen.has(name), "HTML_ATTRIBUTE_DUPLICATE");
		seen.add(name);
		attributes.push({ name, originalName: item[1], value: item[2] ?? item[3] ?? item[4] });
		text = text.slice(item[0].length);
	}
	return { name: match[1].toLowerCase(), originalName: match[1], attributes, selfClosing: /\/\s*>$/.test(raw) };
}
function validateScript(code, handler = false) {
	try {
		new vm.Script(handler ? `(function(event){${code}\n})` : code);
	} catch {
		throw new WebpageError("SCRIPT_SYNTAX_INVALID");
	}
}

// A read-only static check, not an HTML sanitizer or a browser substitute.
export async function checkHtml(file, { workspace = process.cwd() } = {}) {
	const source = (await readInput(workspace, file, LIMITS.html)).toString("utf8");
	requireThat(
		/<!doctype\s+html\s*>/i.test(source) &&
			/<html(?:\s|>)/i.test(source) &&
			/<head(?:\s|>)/i.test(source) &&
			/<body(?:\s|>)/i.test(source) &&
			/<\/html\s*>/i.test(source) &&
			/<\/head\s*>/i.test(source) &&
			/<\/body\s*>/i.test(source),
		"HTML_DOCUMENT_REQUIRED",
	);
	let cursor = 0,
		inlineScripts = 0;
	const warnings = new Set();
	while (cursor < source.length) {
		const open = source.indexOf("<", cursor);
		if (open < 0) break;
		if (source.startsWith("<!--", open)) {
			const end = source.indexOf("-->", open + 4);
			requireThat(end >= 0, "HTML_TAG_INVALID");
			cursor = end + 3;
			continue;
		}
		const raw = tagAt(source, open);
		cursor = open + raw.length;
		if (/^<!doctype\b/i.test(raw) || /^<\//.test(raw)) continue;
		const tag = parseTag(raw);
		for (const attribute of tag.attributes) {
			const value = attribute.value === undefined ? undefined : decodeAttribute(attribute.value);
			if (value === undefined) continue;
			if (attribute.name.startsWith("on")) validateScript(value, true);
			if (["src", "href", "xlink:href", "poster", "srcset", "style"].includes(attribute.name))
				requireThat(!/asset:/.test(value), "ASSET_PLACEHOLDER_UNRESOLVED");
		}
		if (["script", "style", "textarea", "title"].includes(tag.name)) {
			const closing = new RegExp(`</${tag.name}\\s*>`, "ig");
			closing.lastIndex = cursor;
			const close = closing.exec(source);
			requireThat(close, "HTML_TAG_INVALID");
			const content = source.slice(cursor, close.index);
			if (tag.name === "style") requireThat(!/url\(\s*["']?asset:/.test(content), "ASSET_PLACEHOLDER_UNRESOLVED");
			if (tag.name === "script") {
				const type = (tag.attributes.find((a) => a.name === "type")?.value ?? "").toLowerCase();
				if (tag.attributes.some((a) => a.name === "src")) warnings.add("EXTERNAL_SCRIPT_NOT_CHECKED");
				else if (["application/json", "application/ld+json", "importmap"].includes(type)) {
					try {
						JSON.parse(content);
					} catch {
						throw new WebpageError("SCRIPT_JSON_INVALID");
					}
				} else if (type === "module") warnings.add("MODULE_SCRIPT_NOT_CHECKED");
				else if (["", "text/javascript", "application/javascript"].includes(type)) {
					validateScript(content);
					inlineScripts++;
				}
			}
			cursor = close.index + close[0].length;
		}
	}
	return {
		file,
		bytes: Buffer.byteLength(source),
		inlineScripts,
		staticChecks: "passed",
		warnings: [...warnings],
		browserInteraction: "not-verified",
	};
}

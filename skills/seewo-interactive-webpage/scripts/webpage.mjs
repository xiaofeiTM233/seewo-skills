#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import { realpath } from "node:fs/promises";
import { LIMITS, requireThat } from "./lib/core.mjs";
import { checkHtml } from "./lib/check.mjs";
import { PUBLIC_CSTORE, uploadImage } from "./lib/upload.mjs";

const commands = ["upload-image", "check"];
export function parseArguments(args) {
	requireThat(commands.includes(args[0]), "COMMAND_UNKNOWN");
	requireThat(args.length === 3 && args[1] === "--file" && args[2] && !args[2].startsWith("--"), "ARGUMENT_INVALID");
	return { command: args[0], file: args[2] };
}
export async function main(args = process.argv.slice(2)) {
	const controller = new AbortController();
	const cancel = () => controller.abort();
	process.once("SIGINT", cancel);
	process.once("SIGTERM", cancel);
	try {
		if (args.length === 1 && args[0] === "--help")
			return {
				ok: true,
				commands,
				policyUrl: PUBLIC_CSTORE.policyUrl,
				documentation: "references/cli.md",
			};
		const { command, file } = parseArguments(args);
		const result = command === "check" ? await checkHtml(file) : await uploadImage(file, { signal: controller.signal });
		return { ok: true, ...result };
	} catch (error) {
		process.exitCode = 1;
		return {
			ok: false,
			error:
				typeof error.code === "string" && /^[A-Z_]{1,64}$/.test(error.code)
					? error.code
					: controller.signal.aborted
						? "CANCELLED"
						: "OPERATION_FAILED",
		};
	} finally {
		process.removeListener("SIGINT", cancel);
		process.removeListener("SIGTERM", cancel);
	}
}
// Node resolves module URLs to canonical paths, but argv retains installation
// aliases (for example /var -> /private/var on macOS). Resolve only the entry
// identity here; workspace path and symlink checks remain in the file layer.
const entryPath = process.argv[1] ? await realpath(process.argv[1]).catch(() => undefined) : undefined;
if (entryPath && entryPath === (await realpath(fileURLToPath(import.meta.url)))) {
	const output = JSON.stringify(await main());
	if (output.length > LIMITS.output) process.exitCode = 1;
	process.stdout.write(output.length <= LIMITS.output ? `${output}\n` : '{"ok":false,"error":"OUTPUT_TOO_LARGE"}\n');
}

// Canonical business-only driver. Regenerate package copies with scripts/sync-connector-drivers.mjs --write.
import process from "node:process";
import console from "node:console";
import { URL } from "node:url";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
const descriptor = JSON.parse(await readFile(new URL("../cli.json", import.meta.url), "utf8"));
const binary = process.env.YIKE_CLI_BINARY;
const args = process.argv.slice(2);
if (!binary || args[0] === "--connection") {
	console.error("请在连接器界面准备程序并管理账号连接。");
	process.exit(3);
}
const discovery =
	(args.at(-1) === "--help" && args.slice(0, -1).every((arg) => /^[a-zA-Z+][a-zA-Z0-9_+-]*$/.test(arg))) ||
	args[0] === "schema" ||
	(args.length === 1 && args[0] === "--version") ||
	descriptor.business?.publicCommands?.some((prefix) => prefix.every((arg, index) => args[index] === arg));
const literals =
	descriptor.schemaVersion === 2
		? (descriptor.commandPolicy?.fixedArguments ?? [])
				.filter(({ value }) => "literal" in value)
				.map(({ option, value }) => [option, value.literal])
		: descriptor.business?.userArguments?.length
			? [descriptor.business.userArguments]
			: [];
const forwarded = [...args];
if (!discovery)
	for (const [option, value] of literals) {
		if (!args.some((arg) => arg === option || arg.startsWith(option + "="))) forwarded.push(option, value);
	}
const child = spawn(
	process.env.YIKE_CLI_USE_NODE === "1" ? process.execPath : binary,
	process.env.YIKE_CLI_USE_NODE === "1" ? [binary, ...forwarded] : forwarded,
	{ shell: false, stdio: "inherit", env: process.env, windowsHide: true },
);
child.on("error", () => {
	console.error("CLI 执行失败，请检查本机程序。");
	process.exitCode = 3;
});
child.on("close", (code) => {
	process.exitCode = code ?? 3;
});

import { readFile, lstat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import console from "node:console";

const validString = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 255;
/** 仅对宿主已查询的摘要做确定性筛选；coverage 是调用者声明，不证明全局查询已完成。 */
export function selectSourceCandidates(input) {
	if (!input || !["complete", "partial", "failed"].includes(input.coverage) || !Array.isArray(input.batches))
		throw new Error("INVALID_SOURCE_SUMMARIES");
	const resources = new Map();
	let observed = 0;
	for (const batch of input.batches) {
		if (!batch || !["courseware", "teaching_plan"].includes(batch.kind) || !Array.isArray(batch.items))
			throw new Error("INVALID_SOURCE_SUMMARIES");
		for (const item of batch.items) {
			if (++observed > 200) throw new Error("SOURCE_SUMMARIES_BUDGET_EXCEEDED");
			if (!item || item.type !== (batch.kind === "courseware" ? "courseware" : "plan")) continue;
			if (!validString(item.id) || !validString(item.name)) throw new Error("INVALID_SOURCE_SUMMARIES");
			const key = `${batch.kind}:${item.id}`;
			const candidate = {
				kind: batch.kind,
				id: item.id,
				title: item.name,
				version: item.version,
				updatedAt: item.updated_at,
			};
			const prior = resources.get(key);
			// 同一来源重复出现时保留较新版本；不能从旧版时间推断新版的缺失时间。
			if (
				!prior ||
				(Number.isSafeInteger(candidate.version) &&
					(!Number.isSafeInteger(prior.version) || candidate.version > prior.version)) ||
				(candidate.version === prior.version &&
					Number.isSafeInteger(candidate.updatedAt) &&
					(!Number.isSafeInteger(prior.updatedAt) || candidate.updatedAt > prior.updatedAt))
			)
				resources.set(key, candidate);
		}
	}
	const eligible = [...resources.values()].filter(
		(item) =>
			Number.isSafeInteger(item.version) &&
			item.version >= 3 &&
			Number.isSafeInteger(item.updatedAt) &&
			item.updatedAt >= 0,
	);
	eligible.sort(
		(a, b) =>
			b.updatedAt - a.updatedAt || b.version - a.version || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id),
	);
	return {
		status:
			input.coverage === "failed"
				? "query_failed"
				: eligible.length
					? "candidates"
					: resources.size
						? "no_eligible"
						: input.coverage === "complete" && observed === 0
							? "empty"
							: "incomplete",
		coverage: input.coverage,
		globalLatestVerified: false,
		resourceCount: resources.size,
		eligibleCount: eligible.length,
		omitted: Math.max(0, eligible.length - 5),
		candidates: input.coverage === "failed" ? [] : eligible.slice(0, 5),
	};
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	try {
		if (process.argv.length !== 3) throw new Error("INVALID_ARGUMENTS");
		const path = process.argv[2];
		const metadata = await lstat(path);
		if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 256 * 1024)
			throw new Error("INVALID_SOURCE_FILE");
		console.log(JSON.stringify({ ok: true, data: selectSourceCandidates(JSON.parse(await readFile(path, "utf8"))) }));
	} catch {
		console.error(
			JSON.stringify({
				ok: false,
				error: "SOURCE_SELECTION_FAILED",
				hint: "检查本地摘要格式和200项预算；不要重试业务写入。",
			}),
		);
		process.exitCode = 1;
	}
}

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";
import { coursewareQueryInputSchema } from "../../../packages/features/courseware/definition/src/cloud-input.ts";

const source = await readFile(new URL("../scripts/collect-recent-courseware.js", import.meta.url), "utf8");
const collector = new Script(`(async () => {\n${source}\n})()`);
const cacheKey = "seewo-data-review:recent-courseware";
const now = Date.parse("2026-10-20T01:00:00.000Z");

function item(id, updatedAt = now - 1000, extra = {}) {
	return { id, type: "courseware", name: `课件 ${id}`, parent_id: "", updated_at: updatedAt, version: 1, ...extra };
}

function fixture(respond, clock = now) {
	const queries = [];
	const stored = new Map();
	let summary;
	class FixedDate extends Date {
		static now() {
			return clock;
		}
	}
	const context = createContext({
		Date: FixedDate,
		load: (key) => structuredClone(stored.get(key)),
		store: (key, value) => stored.set(key, structuredClone(value)),
		text: (value) => {
			summary = structuredClone(value);
		},
		tools: {
			async mcp__company_capabilities__courseware_query(args) {
				const input = coursewareQueryInputSchema.parse(args);
				queries.push(structuredClone(input));
				assert.equal(input.action, "query");
				return { structuredContent: await respond(input, queries.length) };
			},
		},
	});
	return {
		queries,
		stored,
		async run() {
			await collector.runInContext(context);
			return summary;
		},
	};
}

test("固定北京时间的六个自然月，保留同日同时并在月末截断", async () => {
	for (const [end, begin] of [
		["2026-10-20T01:00:00.000Z", "2026-04-20T01:00:00.000Z"],
		["2026-08-31T15:59:59.999Z", "2026-02-28T15:59:59.999Z"],
		["2024-08-31T01:00:00.000Z", "2024-02-29T01:00:00.000Z"],
	]) {
		const f = fixture(() => ({ items: [], has_more: false }), Date.parse(end));
		const result = await f.run();
		assert.equal(f.queries[0].updated_from, Date.parse(begin));
		assert.equal(f.queries[0].updated_to, Date.parse(end));
		assert.equal(result.coverage.updatedCoursewareCount, 0);
		assert.equal(result.coverage.complete, true);
	}
});

test("大型课件库只取五页，缓存复用不重查，不输出完整半年的总数或月度分布", async () => {
	const f = fixture(({ offset }) => ({
		items: Array.from({ length: 100 }, (_, index) => item(String(offset + index), now - (offset + index + 1) * 1000)),
		has_more: true,
	}));
	const result = await f.run();
	assert.deepEqual(
		f.queries.map((query) => query.offset),
		[0, 100, 200, 300, 400],
	);
	assert.equal(result.coverage.readCount, 500);
	assert.equal(result.coverage.complete, false);
	assert.equal(result.coverage.stopReason, "page_limit");
	assert.equal(result.coverage.updatedCoursewareCount, null);
	assert.equal(result.monthlyLastUpdates, null);
	assert.equal(result.recentExamples.length, 20);
	assert.deepEqual(await f.run(), result);
	assert.equal(f.queries.length, 5);
	assert(f.queries.every((query) => query.updated_from === f.queries[0].updated_from && query.updated_to === now));
});

test("短页仍按 has_more 继续，以原始条数推进，只按最近更新时间归月", async () => {
	const f = fixture(({ offset }) =>
		offset === 0
			? { items: [item("one", Date.parse("2026-09-30T16:00:00Z"), { version: 105 })], has_more: true }
			: { items: [item("two", Date.parse("2026-09-30T15:59:59Z"))], has_more: false },
	);
	const result = await f.run();
	assert.deepEqual(
		f.queries.map((query) => query.offset),
		[0, 1],
	);
	assert.equal(result.coverage.updatedCoursewareCount, 2);
	assert.deepEqual(result.monthlyLastUpdates, [
		{ month: "2026-09", count: 1 },
		{ month: "2026-10", count: 1 },
	]);
	assert.equal(result.higherVersionExamples[0].version, 105);
});

test("429 保留此前成功结果，停止读取且同轮不自动重试", async () => {
	const f = fixture((_input, call) => {
		if (call === 2) throw new Error("MCP HTTP request failed with status 429");
		return { items: [item("saved")], has_more: true };
	});
	const result = await f.run();
	assert.equal(result.coverage.stopReason, "rate_limited");
	assert.equal(result.coverage.pagesRead, 1);
	assert.equal(result.coverage.readCount, 1);
	assert.equal(result.coverage.complete, false);
	assert.equal(f.stored.get(cacheKey).items[0].id, "saved");
	await f.run();
	assert.equal(f.queries.length, 2);
});

test("重复记录、越界时间和目录节点不冒充完整课件数量，偏移仍按原始页长推进", async () => {
	const f = fixture(({ offset }) =>
		offset === 0
			? {
					items: [item("duplicate"), item("boundary", now), item("folder", now - 1000, { type: "folder" })],
					has_more: true,
				}
			: { items: [item("duplicate", now - 500)], has_more: false },
	);
	const result = await f.run();
	assert.deepEqual(
		f.queries.map((query) => query.offset),
		[0, 3],
	);
	assert.equal(result.coverage.readCount, 1);
	assert.equal(result.coverage.duplicateCount, 1);
	assert.equal(result.coverage.invalidCount, 2);
	assert.equal(result.coverage.complete, false);
	assert.equal(result.coverage.updatedCoursewareCount, null);
	assert.equal(result.recentExamples[0].updated_at, now - 500);
});

test("包含时间下界，空页却声称还有数据时停止而不是循环", async () => {
	const begin = Date.parse("2026-04-20T01:00:00Z");
	const f = fixture((_input, call) =>
		call === 1 ? { items: [item("boundary", begin)], has_more: true } : { items: [], has_more: true },
	);
	const result = await f.run();
	assert.equal(result.coverage.readCount, 1);
	assert.equal(result.coverage.stopReason, "empty_page_with_more");
	assert.equal(result.coverage.complete, false);
	assert.equal(f.queries.length, 2);
});

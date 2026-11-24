import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, Script } from "node:vm";
import { coursewareQueryInputSchema } from "../../../packages/features/courseware/definition/src/cloud-input.ts";

const source = await readFile(new URL("../scripts/collect-annual-courseware.js", import.meta.url), "utf8");
const collector = new Script(`(async () => {\n${source}\n})()`);
const cacheKey = "seewo-data-review:annual-courseware";
const yearsKey = "seewo-data-review:annual-courseware-years";
const now = Date.parse("2026-10-20T01:00:00Z");

function item(id, updatedAt, version = 1) {
	return { id, type: "courseware", name: `课件 ${id}`, parent_id: "", updated_at: updatedAt, version };
}

function fixture(years, respond, { clock = now, recentStopReason } = {}) {
	const stored = new Map([[yearsKey, years]]);
	if (recentStopReason) stored.set("seewo-data-review:recent-courseware", { stopReason: recentStopReason });
	const queries = [];
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
				return respond(input, queries.length);
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

test("连续回顾年份使用北京时间自然年，每年前20份足够即停并复用缓存", async () => {
	const f = fixture([2026, 2024, 2024], (input) => ({
		structuredContent: {
			items: Array.from({ length: 20 }, (_, index) =>
				item(`${input.updated_from}-${index}`, input.updated_from, 100 - index),
			),
			has_more: true,
		},
	}));
	const result = await f.run();
	assert.deepEqual(
		f.queries.map(({ updated_from, updated_to }) => [updated_from, updated_to]),
		[
			[Date.parse("2024-01-01T00:00:00+08:00"), Date.parse("2025-01-01T00:00:00+08:00")],
			[Date.parse("2025-01-01T00:00:00+08:00"), Date.parse("2026-01-01T00:00:00+08:00")],
			[Date.parse("2026-01-01T00:00:00+08:00"), now],
		],
	);
	assert(
		f.queries.every(
			({ action, order_by, limit, offset }) =>
				action === "query" && order_by === "version" && limit === 20 && offset === 0,
		),
	);
	assert(
		result.years.every(
			(annual) =>
				annual.items.length === 20 && annual.rankingComplete && !annual.rangeExhausted && annual.stopReason === "top_n",
		),
	);
	assert.deepEqual(
		result.years.map(({ year }) => year),
		[2024, 2025, 2026],
	);
	assert.equal(result.requestCount, 3);
	assert.deepEqual(result.unreadYears, []);
	assert.deepEqual(await f.run(), result);
	assert.equal(f.queries.length, 3);
	assert.equal(f.stored.get(cacheKey).years.length, 3);
});

test("不足20份需区分范围读完与短页仍有数据，不额外翻页", async () => {
	for (const count of [0, 3])
		for (const has_more of [false, true]) {
			const f = fixture([2025], (input) => ({
				structuredContent: {
					items: Array.from({ length: count }, (_, index) => item(String(index), input.updated_from, 10 - index)),
					has_more,
				},
			}));
			const result = await f.run();
			assert.equal(result.years[0].rankingComplete, !has_more);
			assert.equal(result.years[0].rangeExhausted, !has_more);
			assert.equal(result.years[0].items.length, count);
			assert.equal(result.stopReason, has_more ? "partial_results" : "complete");
			assert.equal(f.queries.length, 1);
		}
});

test("重复、越界、缺失时间与版本乱序保留样本但不声称年度前20完整", async () => {
	const f = fixture([2025, 2026], (input, call) => ({
		structuredContent:
			call === 1
				? {
						items: [
							item("same", input.updated_from, 8),
							item("same", input.updated_from, 8),
							item("later", input.updated_from, 10),
							item("outside", input.updated_to, 1),
							{ ...item("missing", input.updated_from), updated_at: undefined },
						],
						has_more: false,
					}
				: { items: [], has_more: false },
	}));
	const result = await f.run();
	assert.equal(result.years[0].rankingComplete, false);
	assert.equal(result.years[0].duplicateCount, 1);
	assert.equal(result.years[0].invalidCount, 3);
	assert.deepEqual(
		result.years[0].items.map(({ id }) => id),
		["same", "later"],
	);
	assert.equal(result.years[1].rankingComplete, true);
	assert.equal(result.stopReason, "partial_results");
});

test("限流和工具错误保留成功年份并停止，同轮不重试也不切换查询入口", async () => {
	for (const failure of [
		new Error("HTTP 429"),
		{ isError: true, structuredContent: { code: "RATE_LIMITED" } },
		{ isError: true, structuredContent: { code: "BUSINESS_REJECTED" } },
	]) {
		const f = fixture([2024, 2025, 2026], (input, call) => {
			if (call === 1) return { structuredContent: { items: [item("saved", input.updated_from)], has_more: false } };
			if (failure instanceof Error) throw failure;
			return failure;
		});
		const result = await f.run();
		assert.equal(result.years[0].rankingComplete, true);
		assert.equal(result.years[1].rankingComplete, false);
		assert.equal(
			result.stopReason,
			failure?.structuredContent?.code === "BUSINESS_REJECTED" ? "request_failed" : "rate_limited",
		);
		assert.deepEqual(result.unreadYears, [2026]);
		assert.equal(f.stored.get(cacheKey).years[0].items[0].id, "saved");
		await f.run();
		assert.equal(f.queries.length, 2);
	}
});

test("半年已限流时年度查询不再请求", async () => {
	const f = fixture(
		[2025, 2026],
		() => {
			throw new Error("must not dispatch");
		},
		{ recentStopReason: "rate_limited" },
	);
	const result = await f.run();
	assert.equal(result.stopReason, "rate_limited");
	assert.equal(result.requestCount, 0);
	assert.deepEqual(result.unreadYears, [2025, 2026]);
});

test("明确年份才请求，排除不支持和未来年份，1970下界不会变成负数", async () => {
	const missing = fixture(undefined, () => {
		throw new Error("must not dispatch");
	});
	await assert.rejects(missing.run(), /ANNUAL_COURSEWARE_YEARS_REQUIRED/);
	const f = fixture([1969, 1970, 2027, "2025"], () => ({ structuredContent: { items: [], has_more: false } }));
	const result = await f.run();
	assert.deepEqual(result.excludedYears, [1969, 2027, "2025"]);
	assert.deepEqual(
		result.years.map(({ year }) => year),
		[1970],
	);
	assert.equal(f.queries[0].updated_from, 0);
});

test("跨北京时间年界时今年上界仍固定为实际采集时刻", async () => {
	const clock = Date.parse("2026-12-31T16:30:00Z");
	const f = fixture([2027], () => ({ structuredContent: { items: [], has_more: false } }), { clock });
	await f.run();
	assert.equal(f.queries[0].updated_from, Date.parse("2026-12-31T16:00:00Z"));
	assert.equal(f.queries[0].updated_to, clock);
});

test("错误响应形状不当作成功空年份，也不再请求后续年份", async () => {
	const f = fixture([2025, 2026], () => ({ structuredContent: { items: [] } }));
	const result = await f.run();
	assert.equal(result.stopReason, "invalid_response");
	assert.equal(result.years[0].rankingComplete, false);
	assert.deepEqual(result.unreadYears, [2026]);
	assert.equal(f.queries.length, 1);
});

// 在 codemode 中执行；tools、store、load 和 text 由当前宿主提供，不在 Shell 中运行。
const recentCoursewareKey = "seewo-data-review:recent-courseware";
let recentCourseware = load(recentCoursewareKey);
if (!recentCourseware) {
	const updatedTo = Date.now();
	const shanghaiOffset = 8 * 60 * 60 * 1000;
	const localNow = new Date(updatedTo + shanghaiOffset);
	const year = localNow.getUTCFullYear();
	const month = localNow.getUTCMonth() - 6;
	const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
	const updatedFrom =
		Date.UTC(
			year,
			month,
			Math.min(localNow.getUTCDate(), lastDay),
			localNow.getUTCHours(),
			localNow.getUTCMinutes(),
			localNow.getUTCSeconds(),
			localNow.getUTCMilliseconds(),
		) - shanghaiOffset;
	recentCourseware = {
		window: { updatedFrom, updatedTo, timeZone: "Asia/Shanghai" },
		items: [],
		requestCount: 0,
		pagesRead: 0,
		nextOffset: 0,
		complete: false,
		duplicateCount: 0,
		invalidCount: 0,
		stopReason: "page_limit",
	};
	store(recentCoursewareKey, recentCourseware);
	const byId = new Map();
	for (let pageIndex = 0; pageIndex < 5; pageIndex++) {
		recentCourseware.requestCount++;
		store(recentCoursewareKey, recentCourseware);
		let page;
		try {
			const response = await tools.mcp__company_capabilities__courseware_query({
				action: "query",
				updated_from: updatedFrom,
				updated_to: updatedTo,
				limit: 100,
				offset: recentCourseware.nextOffset,
			});
			if (response.isError) throw new Error("MCP_RESULT_ERROR");
			page = response.structuredContent;
		} catch (error) {
			// 只保留停止原因，原始错误留在 Host 工具记录中，不复制可能敏感的请求内容。
			recentCourseware.stopReason = /429|rate.?limit/i.test(String(error)) ? "rate_limited" : "request_failed";
			break;
		}
		if (!Array.isArray(page?.items) || typeof page.has_more !== "boolean" || page.items.length > 100) {
			recentCourseware.stopReason = "invalid_response";
			break;
		}
		recentCourseware.pagesRead++;
		for (const item of page.items) {
			if (
				typeof item?.id !== "string" ||
				!item.id ||
				item.type !== "courseware" ||
				typeof item.name !== "string" ||
				!Number.isSafeInteger(item.updated_at) ||
				item.updated_at < updatedFrom ||
				item.updated_at >= updatedTo
			) {
				recentCourseware.invalidCount++;
				continue;
			}
			const previous = byId.get(item.id);
			if (previous) recentCourseware.duplicateCount++;
			if (!previous || item.updated_at > previous.updated_at) {
				byId.set(item.id, {
					id: item.id,
					name: item.name,
					parent_id: item.parent_id,
					created_at: item.created_at,
					updated_at: item.updated_at,
					version: item.version,
				});
			}
		}
		recentCourseware.items = [...byId.values()].sort((left, right) => right.updated_at - left.updated_at);
		// 分页使用本页原始条数；去重、过滤后的条数不能作为下一页偏移量。
		recentCourseware.nextOffset += page.items.length;
		store(recentCoursewareKey, recentCourseware);
		if (!page.has_more) {
			recentCourseware.complete = recentCourseware.duplicateCount === 0 && recentCourseware.invalidCount === 0;
			recentCourseware.stopReason = recentCourseware.complete ? "complete" : "inconsistent_results";
			break;
		}
		if (page.items.length === 0) {
			recentCourseware.stopReason = "empty_page_with_more";
			break;
		}
	}
	store(recentCoursewareKey, recentCourseware);
}

const monthlyCounts = new Map();
for (const item of recentCourseware.items) {
	const month = new Date(item.updated_at + 8 * 60 * 60 * 1000).toISOString().slice(0, 7);
	monthlyCounts.set(month, (monthlyCounts.get(month) ?? 0) + 1);
}
text({
	window: recentCourseware.window,
	coverage: {
		complete: recentCourseware.complete,
		stopReason: recentCourseware.stopReason,
		requestCount: recentCourseware.requestCount,
		pagesRead: recentCourseware.pagesRead,
		readCount: recentCourseware.items.length,
		updatedCoursewareCount: recentCourseware.complete ? recentCourseware.items.length : null,
		newestUpdatedAt: recentCourseware.items[0]?.updated_at ?? null,
		oldestUpdatedAt: recentCourseware.items.at(-1)?.updated_at ?? null,
		duplicateCount: recentCourseware.duplicateCount,
		invalidCount: recentCourseware.invalidCount,
	},
	// 不完整样本不输出半年月度分布，避免把未覆盖月份写成零或推断趋势。
	monthlyLastUpdates: recentCourseware.complete
		? [...monthlyCounts]
				.sort(([left], [right]) => left.localeCompare(right))
				.map(([month, count]) => ({ month, count }))
		: null,
	recentExamples: recentCourseware.items.slice(0, 20),
	higherVersionExamples: recentCourseware.items
		.filter((item) => Number.isFinite(item.version) && item.version > 1)
		.sort((left, right) => right.version - left.version)
		.slice(0, 3),
});

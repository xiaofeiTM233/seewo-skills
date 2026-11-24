// 在 codemode 中执行；先将本轮连续回顾年份写入 annual-courseware-years，不在 Shell 中运行。
const annualCoursewareKey = "seewo-data-review:annual-courseware";
let annualCourseware = load(annualCoursewareKey);
if (!annualCourseware) {
	const capturedAt = Date.now();
	const shanghaiOffset = 8 * 60 * 60 * 1000;
	const currentYear = new Date(capturedAt + shanghaiOffset).getUTCFullYear();
	const requestedYears = load("seewo-data-review:annual-courseware-years");
	if (!Array.isArray(requestedYears)) throw new Error("ANNUAL_COURSEWARE_YEARS_REQUIRED");
	const validYears = [
		...new Set(requestedYears.filter((year) => Number.isInteger(year) && year >= 1970 && year <= currentYear)),
	].sort((left, right) => left - right);
	const years = validYears.length
		? Array.from({ length: validYears.at(-1) - validYears[0] + 1 }, (_, index) => validYears[0] + index)
		: [];
	annualCourseware = {
		capturedAt,
		timeZone: "Asia/Shanghai",
		topN: 20,
		plannedYears: years,
		excludedYears: requestedYears.filter((year) => !validYears.includes(year)),
		requestCount: 0,
		stopReason: "complete",
		years: [],
	};
	store(annualCoursewareKey, annualCourseware);
	if (load("seewo-data-review:recent-courseware")?.stopReason === "rate_limited") {
		annualCourseware.stopReason = "rate_limited";
	} else
		for (const year of years) {
			const updatedFrom = Math.max(0, Date.UTC(year, 0, 1) - shanghaiOffset);
			const updatedTo = Math.min(capturedAt, Date.UTC(year + 1, 0, 1) - shanghaiOffset);
			const annual = {
				year,
				window: { updatedFrom, updatedTo },
				items: [],
				rankingComplete: false,
				rangeExhausted: false,
				duplicateCount: 0,
				invalidCount: 0,
				stopReason: "request_failed",
			};
			annualCourseware.years.push(annual);
			if (updatedFrom === updatedTo) {
				annual.rankingComplete = true;
				annual.rangeExhausted = true;
				annual.stopReason = "range_exhausted";
				continue;
			}
			annualCourseware.requestCount++;
			store(annualCoursewareKey, annualCourseware);
			let page;
			try {
				const response = await tools.mcp__company_capabilities__courseware_query({
					action: "query",
					updated_from: updatedFrom,
					updated_to: updatedTo,
					order_by: "version",
					limit: 20,
					offset: 0,
				});
				if (response.isError) throw new Error(`MCP_RESULT_ERROR ${response.structuredContent?.code ?? ""}`);
				page = response.structuredContent;
			} catch (error) {
				annual.stopReason = /429|rate.?limit/i.test(String(error)) ? "rate_limited" : "request_failed";
				annualCourseware.stopReason = annual.stopReason;
				break;
			}
			if (!Array.isArray(page?.items) || typeof page.has_more !== "boolean" || page.items.length > 20) {
				annual.stopReason = "invalid_response";
				annualCourseware.stopReason = annual.stopReason;
				break;
			}
			const ids = new Set();
			let previousVersion = Infinity;
			for (const item of page.items) {
				if (
					typeof item?.id !== "string" ||
					!item.id ||
					item.type !== "courseware" ||
					typeof item.name !== "string" ||
					!Number.isSafeInteger(item.version) ||
					!Number.isSafeInteger(item.updated_at) ||
					item.updated_at < updatedFrom ||
					item.updated_at >= updatedTo
				) {
					annual.invalidCount++;
					continue;
				}
				if (item.version > previousVersion) annual.invalidCount++;
				previousVersion = item.version;
				if (ids.has(item.id)) {
					annual.duplicateCount++;
					continue;
				}
				ids.add(item.id);
				annual.items.push({
					id: item.id,
					name: item.name,
					parent_id: item.parent_id,
					created_at: item.created_at,
					updated_at: item.updated_at,
					version: item.version,
				});
			}
			annual.rangeExhausted = !page.has_more && annual.invalidCount === 0 && annual.duplicateCount === 0;
			annual.rankingComplete =
				annual.invalidCount === 0 &&
				annual.duplicateCount === 0 &&
				(annual.items.length === annualCourseware.topN || annual.rangeExhausted);
			annual.stopReason = annual.rankingComplete
				? annual.rangeExhausted
					? "range_exhausted"
					: "top_n"
				: annual.invalidCount || annual.duplicateCount
					? "inconsistent_results"
					: "short_page_with_more";
			store(annualCoursewareKey, annualCourseware);
		}
	if (annualCourseware.stopReason === "complete" && annualCourseware.years.some((annual) => !annual.rankingComplete))
		annualCourseware.stopReason = "partial_results";
	store(annualCoursewareKey, annualCourseware);
}

text({
	timeZone: annualCourseware.timeZone,
	capturedAt: annualCourseware.capturedAt,
	topN: annualCourseware.topN,
	requestCount: annualCourseware.requestCount,
	stopReason: annualCourseware.stopReason,
	excludedYears: annualCourseware.excludedYears,
	unreadYears: annualCourseware.plannedYears.filter(
		(year) => !annualCourseware.years.some((annual) => annual.year === year),
	),
	years: annualCourseware.years,
});

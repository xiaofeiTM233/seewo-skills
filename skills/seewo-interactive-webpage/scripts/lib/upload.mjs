import { imageInfo } from "./images.mjs";
import { LIMITS, readInput, record, requireThat, WebpageError } from "./core.mjs";

// Verified Bloom test endpoint; no Host or environment configuration.
export const PUBLIC_CSTORE = Object.freeze({
	policyUrl: "https://bloom.seewo.com/bloom/api/cstore-public-upload/get-upload-policy",
});

export function httpsUrl(value, code = "URL_REJECTED") {
	let url;
	try {
		url = new URL(value);
	} catch {
		throw new WebpageError(code);
	}
	requireThat(
		typeof value === "string" &&
			value.length <= 4096 &&
			url.protocol === "https:" &&
			!url.username &&
			!url.password &&
			!url.hash,
		code,
	);
	return url;
}
export async function boundedRequest(
	url,
	init,
	{ fetchImpl = fetch, signal, maximum = LIMITS.networkJson, timeoutMs = 30_000 } = {},
) {
	const timed = AbortSignal.timeout(timeoutMs);
	const combined = signal ? AbortSignal.any([signal, timed]) : timed;
	const response = await fetchImpl(url, { ...init, redirect: "error", credentials: "omit", signal: combined });
	const declared = Number(response.headers.get("content-length"));
	if (declared > maximum) {
		await response.body?.cancel();
		throw new WebpageError("RESPONSE_TOO_LARGE");
	}
	const reader = response.body?.getReader();
	const chunks = [];
	let size = 0;
	try {
		while (reader) {
			combined.throwIfAborted();
			const { done, value } = await reader.read();
			if (done) break;
			size += value.byteLength;
			requireThat(size <= maximum, "RESPONSE_TOO_LARGE");
			chunks.push(value);
		}
	} finally {
		if (reader) {
			await reader.cancel().catch(() => {});
			reader.releaseLock();
		}
	}
	return { status: response.status, ok: response.ok, headers: response.headers, bytes: Buffer.concat(chunks, size) };
}
function parseResponse(response, code) {
	requireThat(response.status !== 401 && response.status !== 403, "ACCESS_DENIED");
	requireThat(response.ok, code);
	try {
		const value = JSON.parse(response.bytes.toString("utf8"));
		requireThat(record(value) && value.code === 0 && record(value.data), code);
		return value.data;
	} catch (error) {
		if (error instanceof WebpageError) throw error;
		throw new WebpageError(code);
	}
}
export async function verifyPublicImage(url, asset, dependencies = {}) {
	httpsUrl(url);
	let response;
	try {
		response = await boundedRequest(url, { method: "GET" }, { ...dependencies, maximum: LIMITS.image });
	} catch {
		throw new WebpageError("PUBLIC_URL_UNAVAILABLE");
	}
	requireThat(response.ok, "PUBLIC_URL_UNAVAILABLE");
	const type = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
	const info = imageInfo(response.bytes);
	requireThat(
		type === asset.mimeType && info.mimeType === asset.mimeType && info.sha256 === asset.sha256,
		"PUBLIC_IMAGE_MISMATCH",
	);
}
function policyForm(policy, bytes, asset) {
	requireThat(policy.needCallServer !== true, "NOTIFY_UNSUPPORTED");
	requireThat(policy.httpMethod === undefined || policy.httpMethod === "POST", "POLICY_INVALID");
	requireThat(
		policy.filePartFieldNameInFormFiled === undefined || policy.filePartFieldNameInFormFiled === "file",
		"POLICY_INVALID",
	);
	httpsUrl(policy.uploadUrl);
	requireThat(
		Array.isArray(policy.formFields) &&
			policy.formFields.length <= 64 &&
			Array.isArray(policy.headerFields) &&
			policy.headerFields.length <= 32,
		"POLICY_INVALID",
	);
	const form = new FormData();
	for (const field of policy.formFields) {
		const key = field?.key || field?.name;
		requireThat(
			record(field) &&
				typeof key === "string" &&
				/^[\w.:-]{1,128}$/.test(key) &&
				key.toLowerCase() !== "file" &&
				typeof field.value === "string" &&
				field.value.length <= 32 * 1024,
			"POLICY_INVALID",
		);
		form.append(key, field.value);
	}
	const headers = {};
	for (const group of policy.headerFields) {
		requireThat(record(group), "POLICY_INVALID");
		for (const [key, value] of Object.entries(group)) {
			requireThat(
				/^[!#$%&'*+.^_`|~\w-]{1,128}$/.test(key) &&
					typeof value === "string" &&
					value.length <= 8192 &&
					!/[\r\n]/.test(value),
				"POLICY_INVALID",
			);
			requireThat(
				!/^(cookie|cookie2|host|origin|referer|proxy-authorization|content-length|content-type|connection|transfer-encoding|set-cookie)$/i.test(
					key,
				) && !/^sec-/i.test(key),
				"POLICY_INVALID",
			);
			headers[key] = value;
		}
	}
	form.append("file", new Blob([bytes], { type: asset.mimeType }), `image.${asset.extension}`);
	return { method: "POST", headers, body: form };
}
export async function uploadImage(file, { workspace = process.cwd(), ...dependencies } = {}) {
	const bytes = await readInput(workspace, file, LIMITS.image);
	const asset = imageInfo(bytes);
	const policy = parseResponse(
		await boundedRequest(PUBLIC_CSTORE.policyUrl, { method: "GET" }, dependencies),
		"POLICY_FAILED",
	);
	const request = policyForm(policy, bytes, asset);
	dependencies.signal?.throwIfAborted();
	let response;
	try {
		response = await boundedRequest(policy.uploadUrl, request, { ...dependencies, timeoutMs: 60_000 });
	} catch {
		// A timeout/disconnect after sending may already have created a public object.
		throw new WebpageError("UPLOAD_RESULT_UNKNOWN");
	}
	let result;
	try {
		result = parseResponse(response, "UPLOAD_FAILED");
	} catch (error) {
		let rejected = response.status >= 400 && response.status < 500 && response.status !== 408;
		if (response.ok) {
			try {
				const data = JSON.parse(response.bytes.toString("utf8"));
				rejected = record(data) && typeof data.code === "number" && data.code !== 0;
			} catch {
				/* A malformed success response cannot prove rejection. */
			}
		}
		throw new WebpageError(rejected ? error.code : "UPLOAD_RESULT_UNKNOWN");
	}
	try {
		requireThat(Number(result.fileSize) === asset.bytes, "UPLOAD_RESPONSE_INVALID");
		httpsUrl(result.downloadUrl);
	} catch {
		throw new WebpageError("UPLOAD_RESULT_UNKNOWN");
	}
	// Return a successful upload URL even when its initial availability probe fails,
	// so callers can inspect/reuse it instead of creating another object.
	let verification = "passed";
	try {
		await verifyPublicImage(result.downloadUrl, asset, dependencies);
	} catch (error) {
		verification = error.code ?? "PUBLIC_URL_UNAVAILABLE";
	}
	return { url: result.downloadUrl, mimeType: asset.mimeType, bytes: asset.bytes, sha256: asset.sha256, verification };
}

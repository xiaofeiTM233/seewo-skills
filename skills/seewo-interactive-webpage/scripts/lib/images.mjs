import { digest, LIMITS, requireThat } from "./core.mjs";

export function imageInfo(bytes) {
	requireThat(bytes.length > 0 && bytes.length <= LIMITS.image, "IMAGE_SIZE_INVALID");
	let mimeType, extension, width, height;
	if (bytes.length >= 45 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
		requireThat(bytes.readUInt32BE(8) === 13 && bytes.toString("ascii", 12, 16) === "IHDR", "IMAGE_INVALID");
		width = bytes.readUInt32BE(16);
		height = bytes.readUInt32BE(20);
		let at = 8,
			end = false,
			data = false;
		while (at + 12 <= bytes.length) {
			const size = bytes.readUInt32BE(at),
				type = bytes.toString("ascii", at + 4, at + 8);
			requireThat(at + size + 12 <= bytes.length, "IMAGE_INVALID");
			if (type === "IDAT") data = true;
			at += size + 12;
			if (type === "IEND") {
				requireThat(size === 0 && at === bytes.length, "IMAGE_INVALID");
				end = true;
				break;
			}
		}
		requireThat(end && data, "IMAGE_INVALID");
		mimeType = "image/png";
		extension = "png";
	} else if (bytes.length >= 14 && /^(GIF87a|GIF89a)$/.test(bytes.toString("ascii", 0, 6))) {
		width = bytes.readUInt16LE(6);
		height = bytes.readUInt16LE(8);
		requireThat(bytes[bytes.length - 1] === 0x3b && bytes.includes(0x2c, 13), "IMAGE_INVALID");
		mimeType = "image/gif";
		extension = "gif";
	} else if (bytes.length >= 12 && bytes[0] === 0xff && bytes[1] === 0xd8) {
		requireThat(bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9, "IMAGE_INVALID");
		let at = 2;
		while (at + 4 < bytes.length) {
			requireThat(bytes[at] === 0xff, "IMAGE_INVALID");
			while (bytes[at] === 0xff) at++;
			const marker = bytes[at++];
			if (marker === 0xda || marker === 0xd9) break;
			if (marker >= 0xd0 && marker <= 0xd7) continue;
			const size = bytes.readUInt16BE(at);
			requireThat(size >= 2 && at + size <= bytes.length, "IMAGE_INVALID");
			if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
				requireThat(size >= 8, "IMAGE_INVALID");
				height = bytes.readUInt16BE(at + 3);
				width = bytes.readUInt16BE(at + 5);
			}
			at += size;
		}
		mimeType = "image/jpeg";
		extension = "jpg";
	} else if (
		bytes.length >= 30 &&
		bytes.toString("ascii", 0, 4) === "RIFF" &&
		bytes.toString("ascii", 8, 12) === "WEBP"
	) {
		requireThat(bytes.readUInt32LE(4) + 8 === bytes.length, "IMAGE_INVALID");
		const type = bytes.toString("ascii", 12, 16);
		if (type === "VP8X") {
			width = bytes.readUIntLE(24, 3) + 1;
			height = bytes.readUIntLE(27, 3) + 1;
		} else if (type === "VP8L") {
			requireThat(bytes[20] === 0x2f, "IMAGE_INVALID");
			const bits = bytes.readUInt32LE(21);
			width = (bits & 0x3fff) + 1;
			height = ((bits >>> 14) & 0x3fff) + 1;
		} else if (type === "VP8 ") {
			requireThat(bytes.subarray(23, 26).equals(Buffer.from([0x9d, 1, 0x2a])), "IMAGE_INVALID");
			width = bytes.readUInt16LE(26) & 0x3fff;
			height = bytes.readUInt16LE(28) & 0x3fff;
		}
		let at = 12;
		while (at + 8 <= bytes.length) {
			const size = bytes.readUInt32LE(at + 4);
			at += 8 + size + (size % 2);
		}
		requireThat(at === bytes.length, "IMAGE_INVALID");
		mimeType = "image/webp";
		extension = "webp";
	}
	requireThat(mimeType && width > 0 && height > 0 && width * height <= 40_000_000, "IMAGE_INVALID");
	return { mimeType, extension, width, height, bytes: bytes.length, sha256: digest(bytes) };
}

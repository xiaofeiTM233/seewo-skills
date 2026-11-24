// A PDF using a built-in CJK CMap without a ToUnicode map, plus one blank page.
export function chinesePdfFixture() {
	const content = "BT /F1 24 Tf 72 700 Td <4F60597D4E2D6587> Tj ET";
	const objects = [
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R 8 0 R] /Count 2 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 7 0 R >>",
		"<< /Type /Font /Subtype /Type0 /BaseFont /STSong-Light /Encoding /UniGB-UCS2-H /DescendantFonts [5 0 R] >>",
		"<< /Type /Font /Subtype /CIDFontType0 /BaseFont /STSong-Light /CIDSystemInfo << /Registry (Adobe) /Ordering (GB1) /Supplement 4 >> /FontDescriptor 6 0 R >>",
		"<< /Type /FontDescriptor /FontName /STSong-Light /Flags 4 /FontBBox [0 -200 1000 900] /ItalicAngle 0 /Ascent 800 /Descent -200 /CapHeight 700 /StemV 80 >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << >> /Contents 9 0 R >>",
		"<< /Length 0 >>\nstream\n\nendstream",
	];
	return pdfFixture(objects);
}

export function unusualMappingPdfFixture() {
	const content = "BT /F1 24 Tf 72 700 Td <414243> Tj ET";
	const cmap = "/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n" +
		"/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n" +
		"/CMapName /Custom def\n/CMapType 2 def\n1 begincodespacerange\n<00> <FF>\nendcodespacerange\n" +
		"3 beginbfchar\n<41> <0041>\n<42> <E000>\n<43> <0001>\nendbfchar\n" +
		"endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend";
	return pdfFixture([
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding /ToUnicode 6 0 R >>",
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
		`<< /Length ${cmap.length} >>\nstream\n${cmap}\nendstream`,
	]);
}

function pdfFixture(objects) {
	let data = "%PDF-1.4\n";
	const offsets = [];
	for (const [index, object] of objects.entries()) {
		offsets.push(Buffer.byteLength(data));
		data += `${index + 1} 0 obj\n${object}\nendobj\n`;
	}
	const xref = Buffer.byteLength(data);
	data += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	data += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
	data += `trailer\n<< /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xref}\n%%EOF\n`;
	return Buffer.from(data, "ascii");
}

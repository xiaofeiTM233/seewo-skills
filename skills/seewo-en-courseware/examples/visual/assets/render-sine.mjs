// Deterministic, inspectable scientific sample. Production authoring uses the diagram node.
import { createRequire } from "node:module";
import { writeFile } from "node:fs/promises";
import { URL } from "node:url";
const require = createRequire(
	new URL("../../../../../packages/features/courseware/agent/package.json", import.meta.url),
);
const { Resvg } = require("@resvg/resvg-js");
const x = (t) => 100 + (t / (Math.PI * 2)) * 780;
const y = (v) => 280 - v * 170;
const points = Array.from({ length: 601 }, (_, i) => {
	const t = (i / 600) * Math.PI * 2;
	return `${i ? "L" : "M"}${x(t).toFixed(2)},${y(Math.sin(t)).toFixed(2)}`;
}).join(" ");
const labels = ["0", "π/2", "π", "3π/2", "2π"];
const ticks = labels
	.map((label, i) => {
		const t = (i * Math.PI) / 2,
			px = x(t),
			py = y(Math.sin(t));
		return `<line x1="${px}" y1="85" x2="${px}" y2="465" stroke="#DEE5EE" stroke-width="1"/>
  <circle cx="${px}" cy="${py}" r="6" fill="#1D57B9"/>
  <text x="${px}" y="${i === 0 ? 316 : 326}" font-size="27" text-anchor="middle" fill="#172B4D">${label}</text>`;
	})
	.join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="560" viewBox="0 0 960 560">
<rect width="960" height="560" fill="#FFFFFF"/>
<g font-family="Arial, sans-serif">
<text x="120" y="52" font-size="30" fill="#172B4D">y = sin x</text>
${ticks}
<line x1="60" y1="280" x2="925" y2="280" stroke="#56677F" stroke-width="2"/>
<path d="M 915 274 L 925 280 L 915 286" fill="none" stroke="#56677F" stroke-width="2"/>
<line x1="100" y1="495" x2="100" y2="70" stroke="#56677F" stroke-width="2"/>
<path d="M 94 80 L 100 70 L 106 80" fill="none" stroke="#56677F" stroke-width="2"/>
<path d="${points}" fill="none" stroke="#1D57B9" stroke-width="5"/>
<text x="73" y="120" font-size="27" text-anchor="end" fill="#172B4D">1</text>
<text x="73" y="460" font-size="27" text-anchor="end" fill="#172B4D">−1</text>
<text x="932" y="287" font-size="27" fill="#172B4D">x</text><text x="90" y="55" font-size="27" fill="#172B4D">y</text>
<text x="490" y="525" font-size="26" text-anchor="middle" fill="#56677F">One period: 2π</text>
</g></svg>`;
await writeFile(new URL("sine.png", import.meta.url), new Resvg(svg).render().asPng());

import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";

const topo = JSON.parse(readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
const geo = feature(topo, topo.objects.countries);

// Equirectangular projection onto an 800x400 viewBox.
const W = 800, H = 400;
const project = ([lon, lat]) => [
  Math.round(((lon + 180) / 360) * W),
  Math.round(((90 - lat) / 180) * H),
];

// Countries that cross the antimeridian (Russia, Fiji, ...) have consecutive
// vertices that project to opposite edges of the map. Drawn as one continuous
// ring that becomes a streak straight across the world, so the ring is broken
// into a new subpath whenever a step jumps more than half the map width.
const ring = (coords) => {
  let d = "", prev = null, open = false;
  for (const c of coords) {
    const p = project(c);
    if (prev && p[0] === prev[0] && p[1] === prev[1]) continue; // duplicate point
    const wrapped = prev && Math.abs(p[0] - prev[0]) > W / 2;
    if (!prev || wrapped) {
      if (open) d += "Z";
      d += "M" + p[0] + " " + p[1];
      open = true;
    } else {
      d += "L" + p[0] + " " + p[1];
    }
    prev = p;
  }
  return open ? d + "Z" : "";
};

// Antarctica spans the whole bottom edge under an equirectangular projection
// and never carries meaningful traffic — it is noise on this chart.
const OMIT = new Set(["AQ"]);

const out = {};
let skipped = 0;
for (const f of geo.features) {
  const numeric = String(f.id).padStart(3, "0");
  const alpha2 = countries.numericToAlpha2(numeric);
  if (!alpha2 || OMIT.has(alpha2)) { skipped++; continue; }

  const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
  let d = "";
  for (const poly of polys) for (const r of poly) d += ring(r);
  if (d) out[alpha2] = d;
}

const body = Object.entries(out)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([k, v]) => `\t${k}: "${v}",`)
  .join("\n");

writeFileSync("src/client/components/charts/worldPaths.ts",
`/**
 * Country outlines for the choropleth, generated from Natural Earth 110m data
 * (via the \`world-atlas\` package) and projected equirectangularly onto an
 * ${W}x${H} viewBox, with coordinates rounded to whole pixels.
 *
 * Baked into the source on purpose: the map must not depend on a CDN at
 * runtime, and the CSP forbids one. Regenerate with \`scripts/gen-world.mjs\`.
 */

// Cropped vertically to roughly 84N-57S: with Antarctica dropped, the full
// -90..90 box would reserve a third of the frame for empty ocean.
export const WORLD_VIEWBOX = "0 12 ${W} 318";

/** ISO-3166-1 alpha-2 to SVG path data. */
export const WORLD_PATHS: Record<string, string> = {
${body}
};
`);

console.log("countries:", Object.keys(out).length, "skipped:", skipped);
console.log("bytes:", readFileSync("src/client/components/charts/worldPaths.ts").length);

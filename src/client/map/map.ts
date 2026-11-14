/*!
 * Leaflet 1.9.4, a JS library for interactive maps. https://leafletjs.com
 *
 * BSD 2-Clause License
 *
 * Copyright (c) 2010-2023, Volodymyr Agafonkin
 * Copyright (c) 2010-2011, CloudMade
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice, this
 *    list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
// The only module that imports Leaflet. `stats.ts` loads it with `import()` so no other page pays for it.

import { circleMarker, latLngBounds, map, tileLayer } from "leaflet";
import { type CityRow, countryName } from "../../shared/stats";

const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const STYLESHEET = "/css/leaflet.css";
// Warsaw: only shown when the owner has no city with coordinates.
const FALLBACK_CENTER: [number, number] = [52.23, 21.01];

function loadStylesheet(): Promise<void> {
  if (document.querySelector(`link[href="${STYLESHEET}"]`)) return Promise.resolve();
  return new Promise((resolve) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLESHEET;
    link.addEventListener("load", () => resolve());
    link.addEventListener("error", () => resolve());
    document.head.append(link);
  });
}

/** Marker size grows with the visits but stays between 6 and 22 px. */
export function radiusFor(visits: number): number {
  return Math.min(22, 6 + Math.sqrt(Math.max(0, visits)) * 2);
}

/** Shows the cities on an OpenStreetMap map inside `container`. Circle markers need no image files. */
export async function showMap(container: HTMLElement, cities: readonly CityRow[]): Promise<void> {
  await loadStylesheet();
  const instance = map(container, { scrollWheelZoom: false });
  tileLayer(TILES, { attribution: ATTRIBUTION, maxZoom: 18 }).addTo(instance);

  const points: [number, number][] = [];
  for (const city of cities) {
    if (city.lat === null || city.lon === null) continue;
    const at: [number, number] = [city.lat, city.lon];
    points.push(at);
    const popup = document.createElement("span");
    popup.textContent = `${city.city}, ${countryName(city.country)}: ${city.visits}`;
    circleMarker(at, {
      radius: radiusFor(city.visits),
      color: "#a66a02",
      weight: 2,
      fillColor: "#fcc011",
      fillOpacity: 0.6,
    })
      .bindPopup(popup)
      .addTo(instance);
  }

  if (points.length === 0) instance.setView(FALLBACK_CENTER, 4);
  else if (points.length === 1) instance.setView(points[0] as [number, number], 9);
  else instance.fitBounds(latLngBounds(points).pad(0.2));
}

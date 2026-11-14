// Owner view of the stats page. The server renders the public numbers; this script adds the cities
// and the map when `links-history` holds the secret key of this link.

import { HISTORY_KEY } from "../shared/form";
import {
  type CityRow,
  countryName,
  findSecretKey,
  hasCoordinates,
  ownerRequest,
  parseCities,
} from "../shared/stats";

function readKey(id: string): string | null {
  try {
    return findSecretKey(JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]"), id);
  } catch {
    return null;
  }
}

async function fetchCities(id: string, key: string): Promise<CityRow[] | null> {
  const { url, init } = ownerRequest(id, key);
  try {
    const res = await fetch(url, init);
    return res.ok ? parseCities(await res.json()) : null;
  } catch {
    return null;
  }
}

function renderCities(list: HTMLElement, cities: readonly CityRow[]): void {
  const max = cities[0]?.visits ?? 0;
  list.replaceChildren(
    ...cities.map((city) => {
      const item = document.createElement("li");
      item.className = "bars__item";
      const label = document.createElement("span");
      label.className = "bars__label";
      label.textContent = `${city.city}, ${countryName(city.country)}`;
      const meter = document.createElement("meter");
      meter.className = "bars__meter";
      meter.min = 0;
      meter.max = max;
      meter.value = city.visits;
      meter.setAttribute("aria-label", `${label.textContent}: ${city.visits}`);
      const value = document.createElement("span");
      value.className = "bars__value";
      value.textContent = String(city.visits);
      item.append(label, meter, value);
      return item;
    }),
  );
}

/** Loads Leaflet once, on the first click or when the map container scrolls into view. */
function setupMap(owner: HTMLElement, cities: readonly CityRow[]): void {
  const button = owner.querySelector<HTMLButtonElement>("[data-map-button]");
  const container = owner.querySelector<HTMLElement>("[data-map]");
  if (!button || !container) return;
  container.hidden = false;

  let started = false;
  const load = async () => {
    if (started) return;
    started = true;
    observer?.disconnect();
    button.disabled = true;
    try {
      const { showMap } = await import("./map/map");
      await showMap(container, cities);
      button.hidden = true;
    } catch {
      started = false;
      button.disabled = false;
    }
  };

  const observer =
    "IntersectionObserver" in window
      ? new IntersectionObserver((entries) => {
          if (entries.some((entry) => entry.isIntersecting)) void load();
        })
      : null;
  observer?.observe(container);
  button.addEventListener("click", () => void load());
}

/** The page view already used one `RL_STATS` token for the server render; this fetch uses a second one. */
async function init(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-stats]");
  const owner = root?.querySelector<HTMLElement>("[data-owner]");
  const id = root?.dataset.id;
  if (!root || !owner || !id) return;
  const key = readKey(id);
  if (key === null) return;
  const cities = await fetchCities(id, key);
  if (cities === null) return;

  owner.hidden = false;
  const list = owner.querySelector<HTMLElement>("[data-cities]");
  if (list) renderCities(list, cities);
  root.querySelector<HTMLElement>("[data-owner-hint]")?.setAttribute("hidden", "");
  if (cities.length === 0) {
    owner.querySelector<HTMLElement>("[data-no-cities]")?.removeAttribute("hidden");
  }
  // Without coordinates there is nothing to draw: the map container and the button stay hidden.
  if (hasCoordinates(cities)) setupMap(owner, cities);
  else owner.querySelector<HTMLElement>("[data-map-bar]")?.setAttribute("hidden", "");
}

void init();

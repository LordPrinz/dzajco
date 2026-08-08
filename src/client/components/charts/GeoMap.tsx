import { useEffect, useMemo } from "react";
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from "react-leaflet";
import type { LatLngBoundsExpression } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "@shared/types";
import { countryFlag, countryName } from "@shared/format";
import { useI18n } from "@/lib/i18n";

/** Reads the chart hue from the CSS tokens so the map tracks the theme. */
function markColor(): string {
	const value = getComputedStyle(document.documentElement)
		.getPropertyValue("--chart-mark")
		.trim();
	return value ? `rgb(${value})` : "#a66a02";
}

/**
 * Marker radius encodes magnitude on a square-root scale, so a point with four
 * times the clicks covers four times the *area* rather than four times the
 * radius. Linear radius exaggerates large values by squaring them visually.
 */
function radiusFor(clicks: number, peak: number): number {
	const MIN = 5;
	const MAX = 26;
	if (peak <= 1) return MIN;
	return MIN + (MAX - MIN) * Math.sqrt(clicks / peak);
}

function FitBounds({ bounds }: { bounds: LatLngBoundsExpression | null }) {
	const map = useMap();

	useEffect(() => {
		if (bounds) map.fitBounds(bounds, { padding: [40, 40], maxZoom: 9 });
	}, [bounds, map]);

	return null;
}

export default function GeoMap({
	points,
	className = "",
}: {
	points: GeoPoint[];
	className?: string;
}) {
	const { t } = useI18n();

	const located = useMemo(
		() =>
			points.filter(
				(point): point is GeoPoint & { lat: number; lon: number } =>
					typeof point.lat === "number" && typeof point.lon === "number"
			),
		[points]
	);

	const peak = Math.max(...located.map((point) => point.clicks), 1);
	const color = markColor();

	const bounds = useMemo<LatLngBoundsExpression | null>(
		() =>
			located.length
				? located.map((point) => [point.lat, point.lon] as [number, number])
				: null,
		[located]
	);

	if (!located.length) {
		return (
			<div
				className={`flex items-center justify-center rounded-2xl bg-sunken text-sm text-faint ${className}`}>
				{t("stats.noData")}
			</div>
		);
	}

	return (
		<div className={`overflow-hidden rounded-2xl ${className}`}>
			<MapContainer
				center={[located[0].lat, located[0].lon]}
				zoom={4}
				scrollWheelZoom={false}
				attributionControl={false}
				className="h-full w-full">
				<TileLayer
					url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
					// Attribution is required by the OSM tile usage policy; it is
					// rendered in the panel footer instead of the map corner.
					attribution="&copy; OpenStreetMap"
				/>
				<FitBounds bounds={bounds} />

				{located.map((point) => (
					<CircleMarker
						key={`${point.country}-${point.region}-${point.city}-${point.lat}-${point.lon}`}
						center={[point.lat, point.lon]}
						radius={radiusFor(point.clicks, peak)}
						pathOptions={{
							color,
							// A 2px ring in the surface colour keeps overlapping
							// markers legible where cities cluster.
							weight: 2,
							opacity: 0.9,
							fillColor: color,
							fillOpacity: 0.35,
						}}>
						<Popup>
							<div className="text-sm">
								<div className="font-bold">
									{countryFlag(point.country)}{" "}
									{[point.city, countryName(point.country)]
										.filter(Boolean)
										.join(", ")}
								</div>
								<div className="text-muted">
									{point.clicks.toLocaleString()}{" "}
									{t(point.clicks === 1 ? "stats.visits_one" : "stats.visits_other")}
								</div>
							</div>
						</Popup>
					</CircleMarker>
				))}
			</MapContainer>
		</div>
	);
}

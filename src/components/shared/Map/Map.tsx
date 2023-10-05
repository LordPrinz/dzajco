"use client";

import { MapContainer, TileLayer, Circle, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { IVisitsLocation } from "@/models/linkModel";
import { cn } from "@/utils/tailwind";

type Props = {
	locations: string;
	className?: string;
};

const Map = ({ locations, className }: Props) => {
	const parsedLocations = JSON.parse(locations) as (IVisitsLocation & {
		location: {
			id: string;
		};
	})[];

	if (!parsedLocations) {
		return null;
	}

	const mostPopularLocation = parsedLocations.reduce((mostPopular, location) => {
		if (!mostPopular || location.visits > mostPopular.visits) {
			return location;
		}
		return mostPopular;
	});

	const highlights = parsedLocations.map((location) => {
		const calcSize = 5 * location.visits;

		return (
			<Circle
				key={location.location.id}
				pathOptions={{
					color: "orange",
				}}
				center={[location.location.lat, location.location.lon]}
				radius={calcSize < 800 ? 800 : calcSize > 4000 ? 4000 : calcSize}>
				<Popup>{location.visits} visits</Popup>
			</Circle>
		);
	});

	return (
		<div className={cn("overflow-hidden", className)}>
			<MapContainer
				attributionControl={false}
				zoomControl={false}
				className="h-full w-full"
				center={[
					mostPopularLocation.location.lat ?? 0,
					mostPopularLocation.location.lon ?? 0,
				]}
				zoom={12}>
				<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
				{highlights}
			</MapContainer>
		</div>
	);
};

export default Map;

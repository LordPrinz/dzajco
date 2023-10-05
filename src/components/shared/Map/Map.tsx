"use client";

import { MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { IVisitsLocation } from "@/models/linkModel";
import { cn } from "@/utils/tailwind";

type Props = {
	locations: string;
	className?: string;
};

const Map = ({ locations, className }: Props) => {
	const parsedLocations = JSON.parse(locations) as IVisitsLocation[];

	if (!parsedLocations) {
		return null;
	}

	const mostPopularLocation = parsedLocations.reduce(
		(mostPopular: IVisitsLocation, location) => {
			if (!mostPopular || location.visits > mostPopular.visits) {
				return location;
			}
			return mostPopular;
		}
	);

	console.log(parsedLocations);

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
			</MapContainer>
		</div>
	);
};

export default Map;

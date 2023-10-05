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

	return (
		<div className={cn("overflow-hidden", className)}>
			<MapContainer
				className="h-full w-full"
				center={[40.3808, 18.3435264]}
				zoom={16}>
				<TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
			</MapContainer>
		</div>
	);
};

export default Map;

"use client";

import { IVisitsLocation } from "@/models/linkModel";
import { useEffect } from "react";

type Props = {
	pageId: string;
};

const getVisitsData = async (pageId: string) => {
	return await fetch(`/api/urls/${pageId}/info`).then((res) => res.json());
};

const Map = ({ pageId }: Props) => {
	useEffect(() => {
		getVisitsData(pageId).then((data) => {
			const visitsLocation = data.visitsLocation as IVisitsLocation[];
			visitsLocation.forEach(async (visit) => {
				const { lat, lon } = visit;
			});
		});
	}, []);

	return (
		<div className="h-full flex items-center justify-center text-4xl ">
			Coming soon...
		</div>
	);
};

export default Map;

"use client";

import { IVisitsLocation } from "@/models/linkModel";
import { useState, useEffect } from "react";
import {
	Chart as ChartJS,
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

const getVisitsData = async (pageId: string) => {
	return await fetch(`/api/urls/${pageId}/info`).then((res) => res.json());
};

type Props = {
	pageId: string;
};

ChartJS.register(
	CategoryScale,
	LinearScale,
	BarElement,
	Title,
	Tooltip,
	Legend
);

export const options = {
	indexAxis: "y" as const,
	elements: {
		bar: {
			borderWidth: 2,
		},
	},
	responsive: true,
	plugins: {
		legend: {
			position: "center" as const,
		},
	},
};

const transformLocationName = (location: string) => {
	const loc = location.split("_");
	return `${loc[0]}, ${loc[2]}`;
};

const Chart = ({ pageId }: Props) => {
	const [locations, setLocations] = useState<IVisitsLocation[] | []>([]);

	useEffect(() => {
		getVisitsData(pageId).then((data) => {
			setLocations(data.visitsLocation);
		});
	}, []);

	const labels = locations.map((location) =>
		transformLocationName(location._id)
	);

	const data = {
		labels,
		datasets: [
			{
				label: "Dataset 1",
				data: locations.map((location) => location.visits),
				borderColor: "#ffcc00",
				backgroundColor: "#ffcc00",
			},
		],
	};

	return <Bar className="h-full" options={options} data={data} />;
};

export default Chart;

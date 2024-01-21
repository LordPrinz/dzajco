import React from "react";
import History from "./_components/History";
import { removeItem } from "./_actions/removeItem";
import HomeButton from "@/components/shared/HomeButton";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "History",
	description: "A links history page",
	alternates: {
		canonical: `/history`,
		languages: {
			"en-US": `/history`,
		},
	},
};

const HistoryPage = () => {
	return (
		<main className="col-[center-start/center-end] mb-16">
			<HomeButton />
			<h1 className="text-center mt-14 text-3xl md:text-4xl font-bold text-jajco-500 ">
				Links History
			</h1>
			<History action={removeItem} />
		</main>
	);
};

export default HistoryPage;

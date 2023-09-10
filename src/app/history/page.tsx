import React from "react";
import History from "./_components/History";
import { removeItem } from "./_actions/removeItem";
import HomeButton from "@/components/shared/HomeButton";

const HistoryPage = () => {
	return (
		<div className="col-[center-start/center-end]">
			<HomeButton />
			<h1 className="text-center mt-14 text-3xl md:text-4xl font-bold text-jajco-500 ">
				Links History
			</h1>
			<History action={removeItem} />
		</div>
	);
};

export default HistoryPage;

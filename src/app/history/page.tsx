import React from "react";
import History from "./_components/History";
import { removeItem } from "./_actions/removeItem";

const HistoryPage = () => {
	return (
		<div className="col-[center-start/center-end]">
			<h1 className="text-center mt-14 text-4xl font-bold text-jajco-500">
				Link History
			</h1>
			<History action={removeItem} />
		</div>
	);
};

export default HistoryPage;

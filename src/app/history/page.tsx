import React from "react";
import History from "./_components/History";

const HistoryPage = () => {
	return (
		<div className="col-[center-start/center-end]">
			<h1 className="text-center mt-14 text-4xl font-bold text-jajco-500">
				Link History
			</h1>
			<History />
		</div>
	);
};

export default HistoryPage;

import React from "react";
import History from "./_components/History";
import { removeItem } from "./_actions/removeItem";
import { GoHomeFill } from "react-icons/go";
import Link from "next/link";

const HistoryPage = () => {
	return (
		<div className="col-[center-start/center-end]">
			<Link
				className="flex text-[#1C1C1C] font-bold absolute text-4xl top-5 left-4 gap-1.5  justify-center px-2 py-1"
				href="/">
				<GoHomeFill className="text-2xl" />{" "}
				<span className="text-lg -translate-y-0.5">Home</span>
			</Link>
			<h1 className="text-center mt-14 text-4xl font-bold text-jajco-500">
				Links History
			</h1>
			<History action={removeItem} />
		</div>
	);
};

export default HistoryPage;

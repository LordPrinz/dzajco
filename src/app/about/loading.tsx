import React from "react";
import Counter from "../[id]/info/_components/Counter";
import HomeButton from "@/components/shared/HomeButton";
import About from "./_components/About";

const Loading = () => {
	return (
		<main className="col-[center-start/center-end]">
			<HomeButton />
			<About />
			<section className="grid gap-2 sm:grid-cols-2  mt-10 grid-rows-[min-content,min-content,min-content,1fr]">
				<div className="info-panel py-4 flex flex-col items-center justify-center h-full">
					<h3 className="font-bold text-3xl text-center mt-12">Shorten Links</h3>
					<Counter visits={0} className="flex-1 flex my-12 justify-center mt-9 " />
				</div>
				<div className="info-panel py-4 ">
					<h3 className="font-bold text-3xl text-center mt-12">Active Links</h3>
					<Counter visits={0} className="flex-1 flex my-12 mt-9 justify-center" />
				</div>
				<div className="info-panel py-4 col-[1/-1]">
					<h3 className="font-bold text-3xl text-center mt-12">Top Locations</h3>
				</div>

				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Total uses</h3>
					<Counter visits={0} className="flex-1 flex my-12 mt-9 justify-center" />
				</div>
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Total Locations</h3>
					<Counter visits={0} className="flex-1 flex my-12 mt-9 justify-center" />
				</div>
				<div className="info-panel col-[1/-1]"></div>
			</section>
		</main>
	);
};

export default Loading;

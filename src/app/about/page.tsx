import Counter from "../[id]/info/_components/Counter";
import dbConnect, { getLinksAmount, getPageStats } from "@/utils/db";
import LocationsScoreboard from "./_components/LocationsScoreboard";
import HomeButton from "@/components/shared/HomeButton";
import { Metadata } from "next";
import dynamicImport from "next/dynamic";
import About from "./_components/About";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "About",
	description: "An About Page with statistics",
	alternates: {
		canonical: `/about`,
		languages: {
			"en-US": `/about`,
		},
	},
};

const LocationsMap = dynamicImport(
	() => import("../../components/shared/Map/Map"),
	{ ssr: false }
);

const AboutPage = async () => {
	await dbConnect();

	const pageInfo = await getPageStats();

	const locations = pageInfo!.visitsLocation;

	const activeLinksAmount = await getLinksAmount();

	return (
		<main className="col-[center-start/center-end]  mb-16">
			<HomeButton />
			<About />
			<section className="grid gap-2 sm:grid-cols-2 mt-10  grid-rows-[min-content,min-content,min-content,1fr]">
				<div className="info-panel py-4 flex flex-col items-center justify-center h-full">
					<h3 className="font-bold text-3xl text-center mt-12">Shorten Links</h3>
					<Counter
						visits={pageInfo!.links}
						className="flex-1 flex my-12 justify-center mt-9 "
					/>
				</div>
				<div className="info-panel py-4 ">
					<h3 className="font-bold text-3xl text-center mt-12">Active Links</h3>
					<Counter
						visits={activeLinksAmount}
						className="flex-1 flex my-12 mt-9 justify-center"
					/>
				</div>
				<div className="info-panel py-4 col-[1/-1]">
					<h3 className="font-bold text-3xl text-center mt-12">Top Locations</h3>
					<LocationsScoreboard locations={locations as any} />
				</div>

				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Total uses</h3>
					<Counter
						visits={pageInfo!.visits}
						className="flex-1 flex my-12 mt-9 justify-center"
					/>
				</div>
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Total Locations</h3>
					<Counter
						visits={locations!.length}
						className="flex-1 flex my-12 mt-9 justify-center"
					/>
				</div>
				<div className="info-panel col-[1/-1]">
					<LocationsMap
						locations={JSON.stringify(locations)}
						className="h-full rounded-xl min-h-[500px]"
					/>
				</div>
			</section>
		</main>
	);
};

export default AboutPage;

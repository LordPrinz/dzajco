import Counter from "../[id]/info/_components/Counter";
import dbConnect, { getLinksAmount, getPageStats } from "@/utils/db";
import Map from "./_components/Map";
import LocationsScoreboard from "./_components/LocationsScoreboard";
import HomeButton from "@/components/shared/HomeButton";
import { Metadata } from "next";

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

const AboutPage = async () => {
	await dbConnect();

	const pageInfo = await getPageStats();

	const locations = pageInfo!.visitsLocation;

	const activeLinksAmount = await getLinksAmount();

	return (
		<main className="col-[center-start/center-end] mt-4">
			<HomeButton />
			<section className="grid gap-2 sm:grid-cols-2 grid-rows-2 mt-12">
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Shorten Links</h3>
					<Counter
						visits={pageInfo!.links}
						className="flex-1 flex my-12 justify-center mt-9"
					/>
				</div>
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Active Links</h3>
					<Counter
						visits={activeLinksAmount}
						className="flex-1 flex my-12 mt-9 justify-center"
					/>
				</div>
				<div className="info-panel py-4 col-[1/-1]">
					<h3 className="font-bold text-3xl text-center mt-12">Top Locations</h3>
					<LocationsScoreboard />
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
				<div className="info-panel py-4 col-[1/-1]">
					<Map />
				</div>
			</section>
		</main>
	);
};

export default AboutPage;

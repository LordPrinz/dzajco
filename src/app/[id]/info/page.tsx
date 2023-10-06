import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound } from "next/navigation";
import Counter from "./_components/Counter";

import Chart from "./_components/Chart";
import dynamic from "next/dynamic";

export type Props = {
	params: { id: string };
};

const LocationsMap = dynamic(
	() => import("../../../components/shared/Map/Map"),
	{ ssr: false }
);

export async function generateMetadata({ params }: Props) {
	return {
		title: "Link info",
		description: "Number of visits on the link",
		alternates: {
			canonical: `/${params.id}/info`,
			languages: {
				"en-US": `/${params.id}/info`,
			},
		},
		twitter: {
			card: "summary_large_image",
		},
		openGraph: {
			title: "Dzajde - free links shortener",
			type: "website",
			url: "https://dzaj.de",
			siteName: "Dzajco",
			description: `${params.id} link statistics`,
		},
	};
}

const Page: NextPage<Props> = async ({ params }) => {
	await dbConnect();

	const link = await findLink({ id: params.id });

	if (!link) {
		notFound();
	}

	return (
		<main className="grid grid-cols-5 sm:grid-rows-5 gap-2 py-4 col-[center-start/center-end] grid-rows-7">
			<div className="info-panel sm:row-start-1 sm:row-end-3 sm:col-start-1 sm:col-end-3 flex flex-col col-[1/-1] row-[1/3]">
				<h3 className="font-bold text-3xl text-center mt-16">Visits</h3>
				<Counter
					visits={link.visits}
					className="flex-1 flex my-12 justify-center"
				/>
			</div>
			<div className="info-panel sm:col-start-1 sm:col-end-3 sm:row-start-3 sm:row-end-6 px-10 flex flex-col items-center  col-[1/-1] row-[3/5] py-8">
				<h3 className="font-bold text-3xl text-center mt-5">Top Visitors</h3>
				<Chart locations={link.visitsLocation} />
			</div>
			<div className="info-panel sm:col-start-3 sm:col-end-6 sm:row-start-1 sm:row-end-6  col-[1/-1] row-[5/7]">
				<LocationsMap
					locations={JSON.stringify(link.visitsLocation)}
					className="h-full rounded-xl min-h-[500px]"
				/>
			</div>
		</main>
	);
};

export default Page;

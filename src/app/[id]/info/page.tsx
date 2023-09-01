import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound } from "next/navigation";
import Counter from "./_components/Counter";
import Map from "./_components/Map";
import { IVisitsLocation } from "@/models/linkModel";

type Props = {
	params: { id: string };
};

export async function generateMetadata({ params }: Props) {
	return {
		title: "Link info",
		description: "Number of visits on the link",
		alternates: {
			canonical: `https://www.dzaj.de/${params.id}/info`,
		},
	};
}

const Page: NextPage<Props> = async ({ params }) => {
	await dbConnect();
	const link = await findLink({ id: params.id });

	if (!link) {
		notFound();
	}

	console.log(link);

	return (
		<main className="grid grid-cols-5 grid-rows-5 gap-2 py-4 col-[center-start/center-end]">
			<div className="info-panel row-start-1 row-end-3 col-start-1 col-end-3">
				<Counter visits={link.visits} />
			</div>
			<div className="info-panel col-start-1 col-end-3 row-start-3 row-end-6"></div>
			<div className="info-panel col-start-3 col-end-6 row-start-1  row-end-6">
				<Map visitsLocations={link.visitsLocation as any} />
			</div>
		</main>
	);
};

export default Page;

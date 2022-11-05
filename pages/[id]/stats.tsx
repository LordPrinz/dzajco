import type { NextPage } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";
import Circle from "../../components/Circle";
import Head from "next/head";
const StatsPage: NextPage = (props: any) => {
	return (
		<>
			<Head>
				<title>Dzajco | Link click counter</title>
			</Head>
			<div className="flex justify-center items-center h-[100vh] flex-col">
				<Circle number={props.clicks} />
			</div>
		</>
	);
};

export default StatsPage;

export async function getServerSideProps({ req }: { req: any }) {
	const url = req.url.slice(1).split("/")[0];

	await dbConnect();

	const link = await linkSchema.findById(url);

	if (!link) {
		return {
			notFound: true,
		};
	}

	return {
		props: {
			clicks: link.clicks,
			page: url,
		},
	};
}

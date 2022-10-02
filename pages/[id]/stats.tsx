import type { NextPage } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";

const StatsPage: NextPage = (props: any) => {
	return (
		<>
			<div>
				<div>Clicks</div>
				<div>{props.clicks}</div>
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

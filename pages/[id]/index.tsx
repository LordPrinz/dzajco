import type { NextApiRequest, NextApiResponse, NextPage } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";

const Page: NextPage = () => {
	return <div>Redirecting...</div>;
};

export default Page;

export async function getServerSideProps({ req }: { req: any }) {
	const url = req.url.slice(1);

	await dbConnect();

	const link = await linkSchema.findById(url);

	if (!link) {
		return {
			notFound: true,
		};
	}

	await linkSchema.findOneAndUpdate({ _id: url }, { clicks: link.clicks + 1 });

	return {
		redirect: {
			destination: link.full,
			permanent: true,
		},
	};
}

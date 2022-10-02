import type { NextApiRequest, NextApiResponse, NextPage } from "next";
import { getUrl } from "../../helpers/api-util";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";

const Page: NextPage = () => {
	return <div>Redirecting...</div>;
};

export default Page;

export async function getServerSideProps({ req }: { req: any }) {
	const url = req.url.slice(1);

	const link = await getUrl(url);

	if (!link.full) {
		return {
			notFound: true,
		};
	}

	return {
		redirect: {
			destination: link.full,
			permanent: true,
		},
	};
}

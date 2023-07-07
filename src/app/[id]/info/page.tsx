import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";

type PageParams = {
	params: {
		[key: string]: string;
	};
};

const Page: NextPage<PageParams> = async ({ params }) => {
	await dbConnect();
	const link = await findLink({ id: params.id });

	if (!link) {
		notFound();
	}

	console.log(link);

	return <div>xd</div>;
};

export default Page;

import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound } from "next/navigation";

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

	return <main>xd</main>;
};

export default Page;

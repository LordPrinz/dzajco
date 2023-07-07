import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";

type PageParams = {
	params: {
		[key: string]: string;
	};
};

type Props = {
	params: { id: string };
	searchParams: { [key: string]: string | string[] | undefined };
};

export async function generateMetadata({ params }: Props) {
	await dbConnect();
	const link = await findLink({ id: params.id });

	if (!link) {
		return {
			title: "Not Found",
			description: "The link you were looking for doesn't exist.",
		};
	}
}

const Page: NextPage<PageParams> = async ({ params }) => {
	await dbConnect();
	const link = await findLink({ id: params.id });

	if (link) {
		link.incrementVisits().then(() => {
			redirect(link.full);
		});
	}

	notFound();
};

export default Page;

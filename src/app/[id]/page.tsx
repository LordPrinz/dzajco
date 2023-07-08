import { encodeCustomName } from "@/utils/api";
import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";

type Props = {
	params: { id: string };
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

const Page: NextPage<Props> = async ({ params }) => {
	await dbConnect();

	const link = await findLink({ id: params.id });

	console.log(link);

	if (link) {
		link.incrementVisits().then(() => {
			setTimeout(() => {
				redirect(
					"https://nextjs.org/docs/app/building-your-application/routing/error-handling"
				);
			}, 3000);
		});
	}

	throw new Error("Rip bozo XD");
	notFound();
};

export default Page;

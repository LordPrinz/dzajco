import dbConnect, { findLink } from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUserLocation } from "@/utils/utils";

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

	const ip = headers().get("x-forwarded-for")!;

	const userLocation = await getUserLocation(
		process.env.NODE_ENV === "development" ? process.env.TEST_IP! : ip
	);

	if (!link) {
		notFound();
	}

	await link.incrementVisits(userLocation);
	redirect(link.full);
};

export default Page;

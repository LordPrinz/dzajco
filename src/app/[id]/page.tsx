import dbConnect, { findLink, findNotDetailedLink, incrementVisits } from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUserLocation } from "@/utils/utils";

type Props = {
	params: { id: string };
};

export async function generateMetadata({ params }: Props) {
	await dbConnect();
	const link = await findNotDetailedLink(params.id);

	if (!link) {
		return {
			title: "Not Found",
			description: "The link you were looking for doesn't exist.",
			alternates: {
				canonical: `/${params.id}`,
				languages: {
					"en-US": `/${params.id}`,
				},
			},
		};
	}
	redirect(link.full.replaceAll("​", ""));
}

const Page: NextPage<Props> = async ({ params }) => {
	await dbConnect();
	const link = await findLink({id:params.id});

	try {
		const ip = headers().get("x-forwarded-for")!;

		const userLocation = await getUserLocation(ip);

		await incrementVisits(userLocation);

		if (!link) {
			return notFound();
		}

		await link.incrementVisits(userLocation);
		
		redirect(link.full.replaceAll("​", ""));
	} catch (error) {
		if (!link) {
			return notFound();
		}

		redirect(link.full.replaceAll("​", ""));
	}
};

export default Page;

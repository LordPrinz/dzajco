import dbConnect, {
	findLink,
	findNotDetailedLink,
	incrementVisits,
} from "@/utils/db";
import { NextPage } from "next";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import { getUserLocation } from "@/utils/utils";
import RedirectPage from "./info/_components/RedirectPage";
import axios from "axios";
import cheerio from "cheerio";

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

	const fullLink = link!.full.replaceAll("​", "");

	if (fullLink.length <= 256) {
		redirect(fullLink);
	}

	try {
		const response = await axios.get(fullLink);
		const html = response.data;
		const $ = cheerio.load(html);

		const title = $("title").text();
		const description = $('meta[name="description"]').attr("content");
		let image = $('meta[property="og:image"]').attr("content");
		if (!image) {
			image = $("img").first().attr("src");
		}
		return {
			title: title || "No Title",
			description: description || "No Description",
			image: image || null,
			// Add other metadata fields here
		};
	} catch (error) {
		console.error(error);
	}
}

const Page: NextPage<Props> = async ({ params }) => {
	await dbConnect();
	const link = await findLink({ id: params.id });

	const fullLink = link!.full.replaceAll("​", "");

	try {
		const ip = headers().get("x-forwarded-for")!;

		const userLocation = await getUserLocation(ip);

		await incrementVisits(userLocation);

		if (!link) {
			return notFound();
		}

		await link.incrementVisits(userLocation);

		if (fullLink.length > 256) {
			return <RedirectPage redirectUrl={fullLink} />;
		}

		redirect(fullLink);
	} catch (error) {
		if (!link) {
			return notFound();
		}
		if (fullLink.length > 256) {
			return <RedirectPage redirectUrl={fullLink} />;
		}
		redirect(fullLink);
	}
};

export default Page;

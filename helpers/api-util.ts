import dbConnect from "../lib/dbConnect";
import linkSchema from "../models/link-schema";
export async function saveUrl(fullUrl: string, customUrl?: string) {
	const response = await fetch("/api/urls", {
		method: "POST",
		body: JSON.stringify({
			url: fullUrl,
			customName: customUrl,
		}),
		headers: {
			"Content-Type": "application/json",
		},
	})
		.then((response) => response.json())
		.catch((err) => console.error(err));

	return response;
}

export async function getUrl(id: string) {
	await dbConnect();

	const link = await linkSchema.findById(id);

	if (!link) {
		return {
			notFound: true,
		};
	}

	await linkSchema.findOneAndUpdate({ _id: id }, { clicks: link.clicks + 1 });

	return link;
}

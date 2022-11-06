import dbConnect from "../lib/dbConnect";
import linkSchema from "../models/link-schema";

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

import { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "../../../../lib/dbConnect";
import linkSchema from "../../../../models/link-schema";
import rateLimit from "../../../../util/rateLimit";

const limiter = rateLimit({
	interval: 1000,
	uniqueTokenPerInterval: 500,
});

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	try {
		await limiter.check(res, 3, process.env.token!); // 3 requests per secound
	} catch {
		return res.status(429).json({ error: "Rate limit exceeded" });
	}

	const url = req.url?.split("/")[3]!;

	await dbConnect();

	const link = await linkSchema.findById(url);

	if (!link) {
		return res.status(404).json("Page not found!");
	}

	return res.status(200).json({ clicks: link.clicks });
}

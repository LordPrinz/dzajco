import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "../../../lib/dbConnect";
import linkSchema from "../../../models/link-schema";
import generateRandom from "../../../util/generateRandom";
import isValidUrl from "../../../util/isValidUrl";
import rateLimit from "../../../util/rateLimit";

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

	if (req.method === "POST") {
		await dbConnect();
		const { body } = req;

		if (!body.url) {
			return res.status(422).json({ message: "No full link provided." });
		}

		if (!isValidUrl(body.url)) {
			return res.status(422).json({ message: "Invalid link provided." });
		}

		const customName = body.customName;

		if (customName) {
			const link = await linkSchema.findOne({ _id: customName });

			if (link) {
				return res.status(422).json({ message: "This name already exists." });
			}

			if (customName.length > 25) {
				return res.status(422).json({
					message:
						"Custom name is too long. Length should be not greater than 25.",
				});
			}

			if (customName.match(/\s/g)) {
				return res
					.status(422)
					.json({ message: "Custom name should not contanin white spaces" });
			}

			linkSchema.insertMany([
				{
					_id: customName,
					full: body.url,
					clicks: 0,
				},
			]);

			return res.status(201).json({ message: "Created", shortUrl: customName });
		}

		const link = await linkSchema.findOne({ full: body.url });

		if (link) {
			return res.status(201).json({ message: "Created", shortUrl: link._id });
		}

		let isGenerated = false;
		let shortUrl: string;
		while (!isGenerated) {
			shortUrl = nanoid(generateRandom(3, 10));
			const link = await linkSchema.findOne({ _id: shortUrl });
			if (link) {
				continue;
			}

			isGenerated = true;

			linkSchema.insertMany([
				{
					_id: shortUrl,
					full: body.url,
					clicks: 0,
				},
			]);
			return res.status(201).json({ message: "Created", shortUrl });
		}
	}

	const url = `${req.headers.host}/404`;
	const fetchRes = await fetch(`https://${url}`);
	const notFoundPage = await fetchRes.text();
	return res.status(404).send(notFoundPage);
}

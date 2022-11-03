import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "../../../lib/dbConnect";
import linkSchema from "../../../models/link-schema";
import generateRandom from "../../../util/generateRandom";
import isValidUrl from "../../../util/isValidUrl";
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	await dbConnect();

	if (req.method === "POST") {
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

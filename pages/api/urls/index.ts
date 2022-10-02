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

		const cutomName = body.customName;

		if (cutomName) {
			const link = await linkSchema.findOne({ _id: cutomName });

			if (link) {
				return res.status(422).json({ message: "This name already exists." });
			}

			linkSchema.insertMany([
				{
					_id: cutomName,
					full: body.url,
					clicks: 0,
				},
			]);

			return res.status(201).json({ message: "Created" });
		}

		let isGenerated = false;

		while (!isGenerated) {
			const shortUrl = nanoid(generateRandom(3, 10));
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
			return res.status(201).json({ message: "Created" });
		}
	}
}

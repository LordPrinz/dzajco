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

			return res.status(201).json({ message: "Created", shortUrl: cutomName });
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
	const protocol = req.headers.referer?.split(/\/\//)[0];

	const fetchRes = await fetch(`${protocol}/${url}`);
	const notFoundPage = await fetchRes.text();
	return res.status(404).send(notFoundPage);
}

import { nanoid } from "nanoid";
import type { NextApiRequest, NextApiResponse } from "next";
import dbConnect from "../../../lib/dbConnect";
import linkSchema from "../../../models/link-schema";
import generateRandom from "../../../util/generateRandom";
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse
) {
	const db = await dbConnect();

	if (req.method === "POST") {
		const { body } = req;

		const cutomName = body.customName;

		if (cutomName) {
			const link = await linkSchema.findOne({ _id: cutomName });
		}

		// nanoid(generateRandom(4, 10));

		res.status(200).json({ message: "Hello from Next.js!" });
	}
	if (req.method === "GET") {
	}
}

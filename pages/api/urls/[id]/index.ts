import { NextApiRequest, NextApiResponse } from "next";
import { getUrl } from "../../../../helpers/api-util";
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

	if (req.method === "GET") {
		const url = req.url?.split("/")[3]!;

		const link = await getUrl(url);

		if (!link.full) {
			return res.status(404).json("Page not found!");
		}

		return res.status(200).json(link.full);
	}
}

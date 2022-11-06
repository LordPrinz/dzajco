import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
	res.send(`
# Allow all user agents.
User-agent: *
Allow: /

 `);
}

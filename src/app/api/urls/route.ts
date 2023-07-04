import { limiter } from "./config/limiter";

export async function POST(requst: Request) {
	const remaining = await limiter.removeTokens(1);
}

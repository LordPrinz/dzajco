import { limiter } from "@/app/api/urls/config/limiter";
import { NextResponse } from "next/server";

export const sendWrongInputResponse = (message: string) => {
	return new NextResponse(message, {
		status: 422,
	});
};

export const handleRateLimiter = async (request: Request) => {
	const origin = request.headers.get("origin");
	const remaining = await limiter.removeTokens(1);

	if (remaining < 0) {
		return new NextResponse(null, {
			status: 429,
			statusText: "Too Many Requests",
			headers: {
				"Access-Control-Allow-Origin": origin || "*",
				"Content-Type": "text/plain",
			},
		});
	}
};

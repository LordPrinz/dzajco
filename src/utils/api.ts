import { limiter } from "@/app/api/urls/config/limiter";
import { NextRequest, NextResponse } from "next/server";

export const sendWrongInputResponse = (message: string) => {
	return new NextResponse(message, {
		status: 422,
	});
};

export const handleRateLimiter = async (request: NextRequest) => {
	if (!request.headers) {
		// Handle the case where headers are not available
		return new NextResponse(null, {
			status: 400,
			statusText: "Bad Request",
		});
	}

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

export const isValidUrl = (url: string) => {
	const urlPattern =
		/^(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/i;
	return urlPattern.test(url);
};

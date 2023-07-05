import { limiter } from "@/app/api/urls/config/limiter";
import { NextRequest, NextResponse } from "next/server";
import { findLink } from "./db";

export const sendWrongInputResponse = (message: string) => {
	return new NextResponse(message, {
		status: 422,
	});
};

export const createLinkResponse = (link: string) => {
	return NextResponse.json({
		message: "Created",
		status: 201,
		shortUrl: link,
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

// TODO: Implement
export const isValidCustomNameFormat = (customName: string) => {
	return true;
};

export const validateCustomName = async (customName: string) => {
	const doesLinkExist = await findLink({ id: customName });
	if (doesLinkExist) {
		return "This name already exists.";
	}

	if (customName.length > 25) {
		return "Custom name is too long. Length should be not greater than 25.";
	}

	if (!isValidCustomNameFormat(customName)) {
		return "Wrong custom name format.";
	}
};

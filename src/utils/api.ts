import { limiter } from "@/app/api/urls/config/limiter";
import { NextRequest, NextResponse } from "next/server";
import { findLink } from "./db";

export const sendWrongInputResponse = (message: string) => {
	return NextResponse.json(
		{
			error: message,
		},
		{
			status: 422,
		}
	);
};

export const createLinkResponse = (link: string) => {
	return NextResponse.json(
		{
			message: "Created",
			shortUrl: link,
		},
		{
			status: 201,
		}
	);
};

export const handleRateLimiter = async (request: NextRequest) => {
	if (!request.headers) {
		// Handle the case where headers are not available
		return NextResponse.json(null, {
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

export const isValidCustomNameFormat = (customName: string) => {
	const invalidCharsAndProtocols = [
		"/",
		"\\",
		"http:",
		"https:",
		"ftp:",
		"mailto:",
	];
	for (const invalidCharOrProtocol of invalidCharsAndProtocols) {
		if (customName.includes(invalidCharOrProtocol)) {
			return false;
		}
	}

	return true;
};

export const encodeCustomName = (customName: string) => {
	return encodeURIComponent(customName.trim());
};

export const validateCustomName = async (customName: string) => {
	const doesLinkExist = await findLink({ id: encodeCustomName(customName) });

	console.log(doesLinkExist);

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

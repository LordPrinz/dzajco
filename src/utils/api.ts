import { limiter } from "@/app/api/urls/config/limiter";
import { NextResponse } from "next/server";
import { findLink } from "./db";

export const sendWrongInputResponse = (message: string) => {
	return NextResponse.json(
		{
			message,
		},
		{
			status: 422,
		}
	);
};

export const createLinkResponse = (
	link: string,
	secretKey: string | null = null
) => {
	return NextResponse.json(
		{
			message: "Created",
			shortUrl: link,
			secretKey,
		},
		{
			status: 201,
		}
	);
};

export const handleRateLimiter = async () => {
	const remaining = await limiter.removeTokens(1);

	return remaining < 0;
};

export const sendRateLimitExceededError = () => {
	return NextResponse.json(
		{
			error: "Too Many Requests",
		},
		{
			status: 429,
			statusText: "Too Many Requests",
			headers: {
				"Access-Control-Allow-Origin": "*",
				"Content-Type": "text/plain",
			},
		}
	);
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

export const validateExpireTime = (expire: string) => {
	const testDate = new Date(expire) as any as string;

	return testDate === "Invalid Date";
};

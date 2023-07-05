import {
	handleRateLimiter,
	isValidUrl,
	sendWrongInputResponse,
	validateCustomName,
} from "@/utils/api";
import { NextRequest, NextResponse } from "next/server";
import { createRequest } from "@/types/apiTypes";
import dbConnect from "@/utils/db";

export async function POST(requst: NextRequest) {
	handleRateLimiter(requst);

	await dbConnect();

	const { url, customName }: Partial<createRequest> = await requst.json();

	if (!url) {
		return sendWrongInputResponse("No full link provided.");
	}

	if (!isValidUrl(url)) {
		return sendWrongInputResponse("Invalid url format provided.");
	}

	if (customName) {
		const error = validateCustomName(customName);

		if (error) {
			return sendWrongInputResponse(error);
		}
	}

	return NextResponse.json({
		msg: "XD",
	});
	//
}

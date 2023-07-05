import { handleRateLimiter, sendWrongInputResponse } from "@/utils/api";
import { limiter } from "./config/limiter";
import { NextRequest, NextResponse } from "next/server";
import { createRequest } from "@/types/apiTypes";

export async function POST(requst: NextRequest) {
	handleRateLimiter(requst);

	const { url, customName }: Partial<createRequest> = await requst.json();

	if (!url) {
		return sendWrongInputResponse("No full link provided.");
	}

	return NextResponse.json({
		msg: "XD",
	});
	//
}

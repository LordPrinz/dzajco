import {
	encodeCustomName,
	handleRateLimiter,
	sendRateLimitExceededError,
} from "@/utils/api";
import dbConnect, { findLink } from "@/utils/db";
import { getUserLocation } from "@/utils/utils";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
	_: NextRequest,
	{ params }: { params: { id: string } }
) {
	const isRateLimitExceeded = await handleRateLimiter();

	await dbConnect();

	if (isRateLimitExceeded) {
		return sendRateLimitExceededError();
	}

	const { id } = params;

	const shortLink = encodeCustomName(id);

	const link = await findLink({ id: shortLink });

	if (!link) {
		return NextResponse.json(
			{
				error: "Link not found!",
			},
			{
				status: 404,
			}
		);
	}

	const ip = headers().get("x-forwarded-for")!;

	const userLocation = await getUserLocation(
		process.env.NODE_ENV === "development" ? process.env.TEST_IP! : ip
	);

	await link.incrementVisits(userLocation);

	return NextResponse.json({
		fullLink: link.full,
	});
}

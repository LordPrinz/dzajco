import {
	encodeCustomName,
	handleRateLimiter,
	sendRateLimitExceededError,
} from "@/utils/api";
import dbConnect, { findLink, incrementVisits } from "@/utils/db";
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

	const ip = headers().get("x-forwarded-for")!;

	const userLocation = await getUserLocation(
		process.env.NODE_ENV === "development" ? process.env.TEST_IP! : ip
	);

	await incrementVisits(userLocation);

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

	return NextResponse.json({
		id: link.id,
		fullLink: link.full,
		visits: link.visits,
		expire: link.expire,
		isCustom: link.isCustom,
		visitsLocation: link?.visitsLocation,
	});
}

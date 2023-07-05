import {
	encodeCustomName,
	handleRateLimiter,
	sendRateLimitExceededError,
} from "@/utils/api";
import dbConnect, { findLink } from "@/utils/db";
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

	await link?.incrementVisits();

	return NextResponse.json({
		fullLink: link?.full,
	});
}

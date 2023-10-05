import { DeleteRequest } from "@/types/apiTypes";
import {
	encodeCustomName,
	handleRateLimiter,
	sendRateLimitExceededError,
	sendWrongInputResponse,
} from "@/utils/api";
import dbConnect, {
	findLink,
	incrementVisits,
} from "@/utils/db";
import { getUserLocation } from "@/utils/utils";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import LinkModel from "@/models/linkModel";
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

	const link = await findLink({id:shortLink});

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

	const userLocation = await getUserLocation(ip);

	await link.incrementVisits(userLocation);
	await incrementVisits(userLocation);

	return NextResponse.json({
		fullLink: link.full,
	});
}

export async function DELETE(
	requst: NextRequest,
	{ params }: { params: { id: string } }
) {
	const isRateLimitExceeded = await handleRateLimiter();

	await dbConnect();

	if (isRateLimitExceeded) {
		return sendRateLimitExceededError();
	}

	try {
		const ip = headers().get("x-forwarded-for")!;

		const userLocation = await getUserLocation(ip);

		await incrementVisits(userLocation);
	} catch (err) {}

	const req: Partial<DeleteRequest> = await requst
		.json()
		.catch(() => sendWrongInputResponse("Something went wrong!"));

	const secretKey = req.secretKey;

	if (!secretKey) {
		return sendWrongInputResponse("No secretKey provided.");
	}
	const { id } = params;

	const { deletedCount } = await LinkModel.deleteOne({
		_id: id,
		secretKey,
	});

	if (deletedCount > 0) {
		return NextResponse.json({
			message: "Link has been deleted.",
		});
	}
	return NextResponse.json({
		message: "No link has been deleted.",
	});
}

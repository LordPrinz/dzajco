import {
	createLinkResponse,
	encodeCustomName,
	handleRateLimiter,
	isValidUrl,
	sendRateLimitExceededError,
	sendWrongInputResponse,
	validateCustomName,
	validateExpireTime,
} from "@/utils/api";
import { NextRequest } from "next/server";
import { CreateRequest } from "@/types/apiTypes";
import dbConnect, { findLink, formLinkModel, saveToDatabase } from "@/utils/db";
import { generateUniqueLink } from "@/utils/utils";

export async function POST(requst: NextRequest) {
	const isRateLimitExceeded = await handleRateLimiter();

	if (isRateLimitExceeded) {
		return sendRateLimitExceededError();
	}

	await dbConnect();

	const { url, customName, expire }: Partial<CreateRequest> =
		await requst.json();

	if (!url) {
		return sendWrongInputResponse("No full link provided.");
	}

	if (!isValidUrl(url)) {
		return sendWrongInputResponse("Invalid url format provided.");
	}

	if (expire && validateExpireTime(expire)) {
		return sendWrongInputResponse("Invalid expiration time provided.");
	}

	if (customName) {
		const error = await validateCustomName(customName);

		if (error) {
			return sendWrongInputResponse(error);
		}

		const encodedCustomName = encodeCustomName(customName);

		const model = formLinkModel({ id: encodedCustomName, full: url, expire });

		await saveToDatabase(model);
		return createLinkResponse(encodedCustomName);
	}

	const existingLink = await findLink({ fullLink: url });

	if (existingLink) {
		return createLinkResponse(existingLink.id);
	}

	const shortUrl = await generateUniqueLink();

	const link = formLinkModel({ id: shortUrl, full: url, expire });

	await saveToDatabase(link);

	return createLinkResponse(shortUrl);
}

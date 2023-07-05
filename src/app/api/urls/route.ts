import {
	createLinkResponse,
	handleRateLimiter,
	isValidUrl,
	sendWrongInputResponse,
	validateCustomName,
} from "@/utils/api";
import { NextRequest } from "next/server";
import { createRequest } from "@/types/apiTypes";
import dbConnect, { findLink, formLinkModel, saveToDatabase } from "@/utils/db";
import { generateUniqueLink } from "@/utils/utils";

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
		const error = await validateCustomName(customName);

		if (error) {
			return sendWrongInputResponse(error);
		}

		const model = formLinkModel({ id: customName, full: url });

		await saveToDatabase(model);
		return createLinkResponse(customName);
	}

	const existingLink = await findLink({ fullLink: url });

	if (existingLink) {
		return createLinkResponse(existingLink.id);
	}

	const shortUrl = await generateUniqueLink();

	const link = formLinkModel({ id: shortUrl, full: url });

	await saveToDatabase(link);

	return createLinkResponse(shortUrl);
}

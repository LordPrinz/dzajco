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
import dbConnect, {
	findLink,
	formLinkModel,
	incrementLinks,
	incrementVisits,
	saveToDatabase,
} from "@/utils/db";
import { generateUniqueLink } from "@/utils/db";
import { headers } from "next/headers";
import { getUserLocation } from "@/utils/utils";
import { nanoid } from "nanoid";

export async function POST(requst: NextRequest) {
	const isRateLimitExceeded = await handleRateLimiter();

	if (isRateLimitExceeded) {
		return sendRateLimitExceededError();
	}

	await dbConnect();

	const req: Partial<CreateRequest> = await requst
		.json()
		.catch(() => sendWrongInputResponse("Something went wrong!"));

	try {
		const ip = headers().get("x-forwarded-for")!;

		const userLocation = await getUserLocation(ip);

		await incrementVisits(userLocation);
	} catch (err) {}

	const url = req.url;
	const customName = req.customName;
	const expire = req.expire;

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

		const secretKey = nanoid(12);

		const model = formLinkModel({
			id: encodedCustomName,
			full: url,
			expire,
			secretKey,
		});

		await saveToDatabase(model);
		await incrementLinks();
		return createLinkResponse(encodedCustomName, secretKey);
	}

	if (expire !== "never") {
		const shortUrl = await generateUniqueLink();
		const secretKey = nanoid(12);

		const link = formLinkModel({
			id: shortUrl,
			full: url,
			expire,
			secretKey,
		});
		await saveToDatabase(link);
		await incrementLinks();
		return createLinkResponse(shortUrl, secretKey);
	}

	const existingLink = await findLink({ fullLink: url, expire: null });

	if (existingLink) {
		return createLinkResponse(existingLink.id);
	}

	const shortUrl = await generateUniqueLink();

	const link = formLinkModel({
		id: shortUrl,
		full: url,
		expire,
	});

	await saveToDatabase(link);
	await incrementLinks();
	return createLinkResponse(shortUrl);
}

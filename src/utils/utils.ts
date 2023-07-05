import { nanoid } from "nanoid";
import { findLink } from "./db";

export const generateRandom = (min: number, max: number): number => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateLink = () => {
	return nanoid(generateRandom(3, 10));
};

export const generateUniqueLink = async () => {
	let shortUrl: string;

	do {
		shortUrl = generateLink();
		const existingLink = await findLink({ id: shortUrl });

		if (existingLink) {
			continue;
		}

		return shortUrl;
	} while (true);
};

import { nanoid } from "nanoid";
import { findLink } from "./db";
import IPData from "ipdata";

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

export type Location = {
	city: string | undefined;
	country: string;
	countryCode: string;
	lat: string;
	lon: string;
};

export const getUserLocation = async (ip: string) => {
	const ipdata = new IPData(process.env.IP_DATA_KEY!);
	const data = await ipdata.lookup(ip);
	return {
		city: data.city,
		country: data.country_name,
		countryCode: data.country_code,
		flag: data.flag,
		lat: data.latitude?.toPrecision(10),
		lon: data.longitude?.toPrecision(10),
	};
};

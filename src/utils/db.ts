import mongoose from "mongoose";
import linkModel from "../models/linkModel";
import { Location, generateLink } from "./utils";
import StatisticsModel from "@/models/statisticsModel";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
	throw new Error("Define the mongodb uri");
}

let cached = (global as any).mongoose;

if (!cached) {
	cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
	if (cached.conn) {
		return cached.conn;
	}

	if (!cached.promise) {
		cached.promise = mongoose.connect(MONGODB_URI!).then((mongoose) => {
			return mongoose;
		});
	}
	cached.conn = await cached.promise;
	return cached.conn;
}

export default dbConnect;

export type FindLinkType = {
	fullLink?: string;
	id?: string;
	expire?: string | null;
};

export type LinkType = {
	id: string;
	full: string;
	visits?: number;
	expire?: string | null;
	secretKey?: string;
};

export const findNotDetailedLink = async (id: string) => {
	return await linkModel.findById(id).select("-visitsLocation");
};

export const findLink = async ({ id, fullLink, expire }: FindLinkType) => {
	if (id) {
		return await linkModel.findById(id);
	}

	if (fullLink && (typeof expire === "object" || typeof expire === "string")) {
		return await linkModel.findOne({ full: fullLink, expire });
	}

	if (fullLink) {
		return await linkModel.findOne({ full: fullLink });
	}
};

export const formLinkModel = ({ id, full, expire, secretKey }: LinkType) => {
	return {
		id,
		full,
		visits: 0,
		expire: expire === "never" ? null : expire,
		visitsLocation: [],
		secretKey,
	};
};

export const saveToDatabase = async (model: LinkType) => {
	const link = new linkModel({
		_id: model.id,
		...model,
	});

	await link.save();
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

export const getPageStats = async () => {
	return await StatisticsModel.findById("dzajcostats");
};

export const getLinksAmount = async () => {
	return await linkModel.count();
};

export const incrementLinks = async () => {
	const statistics = await getPageStats();
	await statistics?.incrementLinks();
};

export const incrementVisits = async (location: Location) => {
	const statistics = await getPageStats();
	await statistics?.incrementVisits(location);
};

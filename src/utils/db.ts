import mongoose from "mongoose";
import linkModel from "../models/linkModel";

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

export type findLinkType = {
	fullLink?: string;
	id?: string;
};

export type linkType = {
	id: string;
	full: string;
	clicks?: number;
	expire?: string;
};

export const findLink = async ({ id, fullLink }: findLinkType) => {
	if (id) {
		return await linkModel.findById(id);
	}

	if (fullLink) {
		return await linkModel.findOne({ full: fullLink });
	}
};

export const formLinkModel = ({ id, full, expire }: linkType) => {
	return {
		_id: id,
		full,
		clicks: 0,
		expire,
	};
};

export const saveToDatabase = async (model: linkType) => {
	const link = new linkModel({
		...model,
	});

	await link.save();
};

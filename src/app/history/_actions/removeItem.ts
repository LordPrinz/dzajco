"use server";

import LinkModel from "@/models/linkModel";
import dbConnect from "@/utils/db";
import { revalidatePath } from "next/cache";

export const removeItem = async (id: string, secretKey: string) => {
	await dbConnect();

	console.log(secretKey);

	const res = await LinkModel.deleteOne({
		_id: id,
		secretKey,
	});

	console.log(res);

	revalidatePath("/history");
};

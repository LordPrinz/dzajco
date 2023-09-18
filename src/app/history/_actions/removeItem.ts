"use server";

import LinkModel from "@/models/linkModel";
import dbConnect from "@/utils/db";
import { revalidatePath } from "next/cache";

export const removeItem = async (id: string) => {
	await dbConnect();

	const res = await LinkModel.deleteOne({
		_id: id,
	});

	console.log(res);

	revalidatePath("/history");
};

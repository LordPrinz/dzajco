"use server";

import LinkModel from "@/models/linkModel";
import dbConnect from "@/utils/db";
import { revalidatePath } from "next/cache";

export const removeItem = async (id: string, secretKey: string) => {

	if(!secretKey) {
		return;
	}
	
	await dbConnect();

	await LinkModel.deleteOne({
		_id: id,
		secretKey,
	});

	revalidatePath("/history");
};

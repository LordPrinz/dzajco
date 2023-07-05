import { handleRateLimiter } from "@/utils/api";
import { NextRequest } from "next/server";

export async function GET(requst: NextRequest) {
	handleRateLimiter();
}

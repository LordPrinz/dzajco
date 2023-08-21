import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import requestIp from "request-ip";

export function middleware(request: NextRequest) {
	const requestHeaders = new Headers(request.headers);

	const ip = requestIp.getClientIp(request as any) as string;

	requestHeaders.set("x-forwarded-for", ip);

	return NextResponse.next({
		request: {
			headers: requestHeaders,
		},
	});
}

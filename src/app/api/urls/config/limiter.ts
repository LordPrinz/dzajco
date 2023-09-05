import { RateLimiter } from "limiter";

export const limiter = new RateLimiter({
	tokensPerInterval: 6,
	interval: "minute",
	fireImmediately: true,
});

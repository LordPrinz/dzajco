import { RateLimiter } from "limiter";

export const limiter = new RateLimiter({
	tokensPerInterval: 2,
	interval: "minute",
	fireImmediately: true,
});

import { expireTime } from "../Form/Input/SelectTimeInput";

export type TPromise = {
	url: string;
	customName?: string;
	errorMessage?: string;
	expiration?: expireTime;
};

export default class Notification {
	promise() {}
}

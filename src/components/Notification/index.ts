import { ToastContent, ToastOptions, toast } from "react-toastify";
import { expireTime } from "../Form/Input/SelectTimeInput";
import { promiseHandler } from "./handlers";
import { copy } from "@/utils/utils";

export type Promise = {
	url: string;
	customName?: string;
	errorMessage?: string;
	expiration?: expireTime;
};

const popupClickHandler = (shortUrl: string) => {
	copy(`${window.location.href}${shortUrl}`);
};

export default class Notification {
	async promise({ url, customName, errorMessage, expiration }: Promise) {
		await toast.promise(
			promiseHandler({ url, customName, errorMessage, expiration }),
			{
				pending: "Loading...",
				error: errorMessage || "An error has occured",
			}
		);
	}

	showError(title: ToastContent<unknown>, restProps?: ToastOptions<unknown>[]) {
		toast(title, {
			autoClose: 5000,
			closeOnClick: true,
			pauseOnHover: true,
			draggable: true,
			type: "error",
			...restProps,
		});
	}
	showSuccess(
		title: ToastContent<unknown>,
		shortUrl: string,
		restProps?: ToastOptions<unknown>[]
	) {
		toast(title, {
			type: "success",
			autoClose: 150000,
			onClick: popupClickHandler.bind(null, shortUrl),
			style: { background: "rgb(229 231 235)" },
			...restProps,
		});
	}
}

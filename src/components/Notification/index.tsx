import { ToastContent, ToastOptions, toast } from "react-toastify";
import LinkCopier from "./utils/LinkCopier";

export const copy = (text: string) => navigator.clipboard.writeText(text);

export type Promise = {
	url: string;
	customName?: string;
	errorMessage?: string;
	expiration?: string;
};

const popupClickHandler = (shortUrl: string) => {
	copy(`${window.location.href}${shortUrl}`);
};

export default class Notification {
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
	async promise({ url, customName, errorMessage, expiration }: Promise) {
		await toast.promise(
			fetch("/api/urls", {
				method: "POST",
				body: JSON.stringify({
					url,
					customName,
					expiration,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}).then(async (response) => {
				response.json().then((data) => {
					if (response.status === 201) {
						return this.showSuccess(
							<LinkCopier url={data.shortUrl} />,
							data.shortUrl
						);
					}
					this.showError(data.message);
				});
			}),
			{
				pending: "Loading...",
				error: errorMessage || "An error has occured",
			}
		);
	}
}

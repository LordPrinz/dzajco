import { ToastContent, ToastOptions, toast } from "react-toastify";
import LinkCopier from "./utils/LinkCopier";
import "react-toastify/dist/ReactToastify.css";
import { Nunito } from "next/font/google";
import { Link } from "@/types/localStorage";

const nunito = Nunito({ subsets: ["latin"] });
export const copy = (text: string) => navigator.clipboard.writeText(text);

export type Promise = {
	url: string;
	customName?: string;
	errorMessage?: string;
	expire?: string;
};

const popupClickHandler = (shortUrl: string) => {
	const link = `https://www.dzaj.de/${decodeURIComponent(shortUrl)}`;
	copy(link.replaceAll(" ", "%20"));
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
			style: { background: "rgb(243 244 246)", fontFamily: "nunito" },
			...restProps,
		});
	}
	async promise({ url, customName, errorMessage, expire }: Promise) {
		await toast.promise(
			fetch("/api/urls", {
				method: "POST",
				body: JSON.stringify({
					url,
					customName,
					expire,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}).then(async (response) => {
				response.json().then((data) => {
					if (response.status === 201) {
						const existingData = JSON.parse(
							window.localStorage.getItem("links-history") || "[]"
						) as Link[];

						const existingLink = existingData.find(
							(link) => link.id === data.shortUrl
						);

						if (!existingLink) {
							let linkToSave;

							if (customName) {
								linkToSave = {
									url,
									secretKey: data.secretKey,
									expire: expire!,
									createdAt: new Date(),
									id: data.shortUrl as string,
								};
							} else {
								linkToSave = {
									url,
									secretKey: data.secretKey,
									expire: expire!,
									createdAt: new Date(),
									id: data.shortUrl as string,
								};
							}

							existingData.push(linkToSave);

							window.localStorage.setItem(
								"links-history",
								JSON.stringify(existingData)
							);
						}
						return this.showSuccess(
							<LinkCopier url={data.shortUrl} />,
							data.shortUrl
						);
					}
					if (response.status === 429) {
						this.showError("Too many requests");
					}
					this.showError(data.message);
				});
			}),
			{
				pending: "Loading...",
				error: errorMessage || "An error has occurred",
			}
		);
	}
}

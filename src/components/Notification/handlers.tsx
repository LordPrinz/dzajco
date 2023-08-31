import Notification, { Promise } from ".";
import LinkCopier from "./utils/LinkCopier";

const notification = new Notification();

export const promiseHandler = async ({
	url,
	customName,
	expiration,
}: Promise) => {
	return await fetch("/api/urls", {
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
				return notification.showSuccess(
					<LinkCopier url={data.shortUrl} />,
					data.shortUrl
				);
			}
			notification.showError(data.message);
		});
	});
};

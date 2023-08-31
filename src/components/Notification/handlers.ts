import Notification, { Promise } from ".";

const notification = new Notification();

export const promiseHandler = async ({
	url,
	customName,
	errorMessage,
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
				// return  show success
			}
			//return show error
		});
	});
};

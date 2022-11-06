import { toast } from "react-toastify";
import LinkCopier from "../../components/LinkCopier";
import showError from "./showError";
import showSuccess from "./showSuccess";

const promiseToast = async ({
	url,
	customName,
}: {
	url: string;
	customName: string;
}) => {
	await toast.promise(
		fetch("/api/urls", {
			method: "POST",
			body: JSON.stringify({
				url,
				customName,
			}),
			headers: {
				"Content-Type": "application/json",
			},
		}).then(async (response) =>
			response.json().then((data) => {
				if (data.status === 201) {
					showSuccess(<LinkCopier url={data.shortUrl} />, data.shortUrl);
				} else {
					showError(data.message);
					Promise.reject();
				}
			})
		),
		{
			pending: "Loading...",
			error: "An error has occured",
		}
	);
};

export default promiseToast;

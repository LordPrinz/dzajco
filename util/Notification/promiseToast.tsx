import { toast } from "react-toastify";
import LinkCopier from "../../components/LinkCopier";
import showError from "./showError";
import showSuccess from "./showSuccess";
import "react-toastify/dist/ReactToastify.css";

const promiseToast = async ({
	url,
	customName,
	errorMessage,
}: {
	url: string;
	customName?: string;
	errorMessage?: string;
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
				if (response.status === 201) {
					return showSuccess(<LinkCopier url={data.shortUrl} />, data.shortUrl);
				}
				showError(data.message);
			})
		),
		{
			pending: "Loading...",
			error: errorMessage || "An error has occured",
		}
	);
};

export default promiseToast;

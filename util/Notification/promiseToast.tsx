import { toast } from "react-toastify";
import LinkCopier from "../../components/LinkCopier";
const promiseToast = async ({ url, customName }: any) => {
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
					toast(<LinkCopier url={data.shortUrl} />, {
						type: "success",
						autoClose: 150000,
						onClick: popupClickHandler.bind(null, data.shortUrl),
						style: { background: "rgb(229 231 235)" },
					});
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

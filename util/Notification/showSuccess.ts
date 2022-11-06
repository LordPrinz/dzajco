import { toast, ToastContent, ToastOptions } from "react-toastify";
import copy from "../copy";
import "react-toastify/dist/ReactToastify.css";

const popupClickHandler = (shortUrl: string) => {
	copy(`${window.location.href}${shortUrl}`);
};

const showSuccess = (
	title: ToastContent<unknown>,
	shortUrl: string,
	restProps?: ToastOptions<unknown>[]
) => {
	toast(title, {
		type: "success",
		autoClose: 150000,
		onClick: popupClickHandler.bind(null, shortUrl),
		style: { background: "rgb(229 231 235)" },
		...restProps,
	});
};

export default showSuccess;

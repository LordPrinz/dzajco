import { toast, ToastContent, ToastOptions } from "react-toastify";

const showError = (
	title: ToastContent<unknown>,
	restProps?: ToastOptions<unknown>[]
) =>
	toast(title, {
		autoClose: 5000,
		closeOnClick: true,
		pauseOnHover: true,
		draggable: true,
		type: "error",
		...restProps,
	});

export default showError;

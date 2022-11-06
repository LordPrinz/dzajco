import { toast, ToastContent, ToastOptions } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

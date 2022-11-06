import { toast } from "react-toastify";

const showError = (title: string, restProps: unknown[]) =>
	toast(title, {
		autoClose: 5000,
		closeOnClick: true,
		pauseOnHover: true,
		draggable: true,
		type: "error",
		...restProps,
	});

export default showError;

import Header from "@/components/Header/Header";
import { ToastContainer } from "react-toastify";

export default function Home() {
	return (
		<main className="">
			<Header />
			<ToastContainer
				position="bottom-right"
				autoClose={5000}
				hideProgressBar={false}
				newestOnTop={true}
				closeOnClick
				rtl={false}
				pauseOnFocusLoss
				draggable
				pauseOnHover
			/>
		</main>
	);
}

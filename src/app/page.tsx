import Header from "@/components/Header/Header";
import MainForm from "@/components/MainForm/MainForm";
import { ToastContainer } from "react-toastify";

export default function Home() {
	return (
		<main className="">
			<Header />
			<MainForm />
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

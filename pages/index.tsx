import type { NextPage } from "next";
import { ToastContainer } from "react-toastify";
import Footer from "../components/Footer";
import Form from "../components/Form";
import Header from "../components/Header";

const Home: NextPage = () => {
	return (
		<>
			<Header />
			<Form />
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
		</>
	);
};

export default Home;

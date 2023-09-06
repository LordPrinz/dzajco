import { Metadata } from "next";

import "./globals.scss";
import Footer from "../components/Layout/Footer/Footer";
import { ToastContainer } from "react-toastify";

export const metadata: Metadata = {
	metadataBase: new URL("https://www.dzaj.de"),
	title: {
		default: "Dzajco",
		template: `%s | Dzajco`,
	},

	description:
		"Free link shortener created by Dzajlopment. It allows to set custom names on links, counts how many times someone entered your short link.",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body className="grid h-screen gridLayout">
				{children}
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
				<Footer/>
			</body>
		</html>
	);
}

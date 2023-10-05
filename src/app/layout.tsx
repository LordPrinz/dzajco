import { Metadata } from "next";

import "./globals.scss";
import Footer from "../components/Layout/Footer/Footer";
import { ToastContainer } from "react-toastify";

export const metadata: Metadata = {
	metadataBase: new URL("https://dzaj.de"),

	title: {
		default: "Dzajde",
		template: `%s | Dzajde`,
	},
	authors: [
		{
			name: "Oskar Płaziński",
			url: "https://github.com/LordPrinz",
		},
		{
			name: "Dzajlopment",
			url: "https://github.com/Lord-Prinz-Team",
		},
	],
	keywords: [
		"Dzajco",
		"Jajco",
		"dzaj.co",
		"dzaj.de",
		"dzaj de",
		"dzaj co",
		"dzajlopment",
		"Dzajlopment",
		"Oskar Płaziński",
		"oskar płaziński",
		"link shortener",
		"link",
		"shortener",
	],
	openGraph: {
		siteName: "Dzajde",
		url: "https://dzaj.de",
		description:
			"Free link shortener created by Dzajlopment. It allows to set custom names on links, counts how many times someone entered your short link.",

		type: "website",
		images: "/opengraph-image.jpg",
	},
	applicationName: "Dzajde",
	publisher: "Oskar Płaziński",
	verification: {
		google: "google3e9900e5e049e579",
	},
	creator: "Oskar Płaziński",
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
			<body className="grid h-full gridLayout overflow-x-hidden">
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
				<Footer />
			</body>
		</html>
	);
}

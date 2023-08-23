import { Metadata } from "next";
import "./globals.scss";
import Footer from "../components/Footer/Footer";

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
			<body className="grid h-screen gridLayout">{children}</body>
		</html>
	);
}

import { Metadata } from "next";

import "./globals.scss";
import Footer from "../components/Layout/Footer/Footer";
import { ToastContainer } from "react-toastify";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import AdBanner from "@/components/ads/AdBanner";
import Script from "next/script";
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
		google: "gisuHn0S23HuiluoHkLO5S3g5JmDAZn4BamBY41gOr0",
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
				<Script
					async
					src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID}`}
					strategy="lazyOnload"
					crossOrigin="anonymous"
				/>
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
				<AdBanner
					slot="8933882351"
					format="auto"
					data-full-width-responsive
					className="col-[center-start/center-end]"
				/>
				<Footer />
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}

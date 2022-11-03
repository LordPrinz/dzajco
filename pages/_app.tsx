import "../styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
function MyApp({ Component, pageProps }: AppProps) {
	return (
		<>
			<Head>
				<title>Dzajco</title>
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="icon" type="image/x-icon" href="logo.svg" />
				<meta name="title" content="Dzajco" />
				<meta
					name="description"
					content="Free link shortener created by Dzajlopment. It allows to set custom names on links, counts how many times someone entered your short link."
				/>
				<meta
					name="keywords"
					content="link, bitly, link shortener, shortener, dzajlopment, LordPrinz, dzajco, dzajcarz, bubr, dżajco, dżajcarz, zip file, Oskar Płaziński, short, short link, zsti, lordprinzteam, team, lpt, best link, best, best link shortener"
				/>
				<meta name="robots" content="index, follow" />
				<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
				<meta name="language" content="English" />
				<meta name="author" content="LordPrinz" />
			</Head>
			<Component {...pageProps} />
		</>
	);
}

export default MyApp;

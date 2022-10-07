import "../styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "react-redux";
import { store } from "../store/store";
import Head from "next/head";
function MyApp({ Component, pageProps }: AppProps) {
	return (
		<Provider store={store}>
			<Head>
				<title>Dzajco</title>
				<meta name="description" content="Dzajco link shortener" />
				<meta name="viewport" content="width=device-width, initial-scale=1.0" />
				<link rel="icon" type="image/x-icon" href="logo.svg" />
			</Head>
			<Component {...pageProps} />
		</Provider>
	);
}

export default MyApp;

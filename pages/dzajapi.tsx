import { NextPage } from "next";
import Head from "next/head";
import Footer from "../components/Footer";
import BackButton from "../components/GoBackButton";

const Api: NextPage = () => {
	return (
		<>
			<Head>
				<title>Dzajco | API</title>
			</Head>
			<BackButton />
			<main className="mainContent">
				<h3 className="h3">Dzaj.de API v1.4.0</h3>
			</main>
		</>
	);
};

export default Api;

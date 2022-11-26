import { NextPage } from "next";
import Head from "next/head";
import Footer from "../components/Footer";
import BackButton from "../components/GoBackButton";
const PrivacyPolicy: NextPage = () => {
	return (
		<>
			<Head>
				<title>Dzajco | Privacy Policy</title>
			</Head>
			<BackButton />
			<main className="mainContent">
				<h3 className="h3">Privacy Policy</h3>
			</main>
		</>
	);
};

export default PrivacyPolicy;

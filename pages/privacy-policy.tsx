import { NextPage } from "next";
import Head from "next/head";
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
				<div className="apiExplanation">
					<ul className="list--decimal">
						<li>
							The administrator of personal data is{" "}
							<a className="link" href="https://github.com/Lord-Prinz-Team">
								Dzajlopment
							</a>
							.
						</li>
						<li>
							You can ask your question via contact email{" "}
							<a className="link" href="mailto:pykejett@gmail.com">
								pykejett@gmail.com
							</a>
							.
						</li>
						<li>
							Your data will be procesed to:
							<ul className="list--points">
								<li>
									<b>Analysis</b>, app will analyze if someone have oppened
									certain link but will not identify who you are. Your personal
									data is not stored in the database.
								</li>
								<li>
									<b>Contact</b>, you can contact me via email. I will use your
									email only to reply to your message.
								</li>
							</ul>
						</li>
						<li>You can request me to delete your shorten link.</li>
					</ul>
				</div>
			</main>
		</>
	);
};

export default PrivacyPolicy;

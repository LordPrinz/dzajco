import { NextPage } from "next";
import Head from "next/head";
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
				<div className="apiExplanation">
					<div className="apiElement">
						<h4 className="h4">Get Redirect URL</h4>
						<div className="code">
							<div className="apiMethod">GET</div> /urls/&#123;shortCode&#125;
						</div>
						<p>Response</p>
						<div className="code">
							Status: <span>200</span>
						</div>
						<div className="code">&#123; "fullLink": string &#125;</div>
					</div>
					<div className="apiElement">
						<h4 className="h4">Get URL Stats</h4>
						<div className="code">
							<div className="apiMethod">GET</div>
							/urls/&#123;shortCode&#125;/stats
						</div>
						<p>Response</p>
						<div className="code">
							Status: <span>200</span>
						</div>
						<div className="code">&#123; "clicks": number &#125;</div>
					</div>
					<div className="apiElement">
						<h4 className="h4">Generate Short Link</h4>
						<div className="code">
							<div className="apiMethod">POST</div>/api/urls
						</div>
						Body
						<div className="code">&#123; "url": string &#125;</div>
						<p>Response</p>
						<div>
							<div className="code">
								Status: <span>201</span>
							</div>
							<div className="code">
								&#123; "message": string, "shortUrl": string &#125;
							</div>
						</div>
						<div>
							<div className="code">
								Status: <span>422</span>
								&#123; "message": string &#125;
							</div>
						</div>
					</div>
				</div>
			</main>
		</>
	);
};

export default Api;

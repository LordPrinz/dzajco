import { NextPage } from "next";
import Head from "next/head";
import BackButton from "../components/GoBackButton";
import Expandable from "../components/Expandable";
import ApiElement from "../components/ApiElement";
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
					<ApiElement
						title="Get Redirect URL"
						method="get"
						endpoint="/urls/&#123;shortCode&#125;"
					>
						<h5 className="h5">Response</h5>
						<div className="jsonCode">
							<div className="statusCode">
								Status: <span>200</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"fullLink": string {"\n"}&#125;
							</pre>
						</div>
					</ApiElement>

					<ApiElement
						title="Get URL Stats"
						method="get"
						endpoint="/urls/&#123;shortCode&#125;/stats"
					>
						<h5 className="h5">Response</h5>
						<div className="jsonCode">
							<div className="statusCode">
								Status: <span>200</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"clicks": number {"\n"}&#125;
							</pre>
						</div>
					</ApiElement>
					<ApiElement
						title="Generate Short Link"
						method="post"
						endpoint="/api/urls"
					>
						<h5 className="h5">Body</h5>
						<div className="jsonCode">
							<pre>
								&#123; {"\n"}
								{"  "}"url": string {"\n"}&#125;
							</pre>
						</div>
						<h5 className="h5">Response</h5>
						<div className="jsonCode">
							<div className="statusCode">
								Status: <span>201</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"message": string {"\n"}
								{"  "}"shortUrl": string{"\n"}&#125;
							</pre>
						</div>
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>422</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"message": string {"\n"}
								&#125;
							</pre>
						</div>
					</ApiElement>
				</div>
			</main>
		</>
	);
};

export default Api;

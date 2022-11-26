import { NextPage } from "next";
import Head from "next/head";
import BackButton from "../components/GoBackButton";
import ApiElement from "../components/ApiElement";
const Api: NextPage = () => {
	return (
		<>
			<Head>
				<title>Dzajco | API</title>
			</Head>
			<BackButton />
			<main className="mainContent">
				<h3 className="h3">Dzajco API v1.4.0</h3>
				<div className="apiExplanation">
					<ApiElement
						title="Get Redirect URL"
						method="get"
						endpoint="/urls/&#123;shortUrl&#125;"
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
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>404</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"message": string {"\n"}
								&#125;
							</pre>
						</div>
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>429</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"error": string {"\n"}
								&#125;
							</pre>
						</div>
					</ApiElement>

					<ApiElement
						title="Get URL Stats"
						method="get"
						endpoint="/urls/&#123;shortUrl&#125;/stats"
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
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>404</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"message": string {"\n"}
								&#125;
							</pre>
						</div>
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>429</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"error": string {"\n"}
								&#125;
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
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>429</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"error": string {"\n"}
								&#125;
							</pre>
						</div>
					</ApiElement>
					<ApiElement
						title="Generate Custom Short Link"
						method="post"
						endpoint="/api/urls"
					>
						<h5 className="h5">Body</h5>
						<div className="jsonCode">
							<pre>
								&#123; {"\n"}
								{"  "}"url": string {"\n"}
								{"  "}"customName": string{"\n"}&#125;
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
						<div className="jsonCode">
							<div className="statusCode statusCode--error">
								Status: <span>429</span>
							</div>
							<pre>
								&#123; {"\n"}
								{"  "}"error": string {"\n"}
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

import Link from "next/link";
import Image from "next/image";
import image from "./../public/cracked_egg.svg";
import Head from "next/head";
import logo from "./../public/logo.svg";
import { NextPage } from "next";

type Props = {
	statusCode: number;
};

const Error: NextPage<Props> = ({ statusCode }) => {
	const errorMessage = statusCode
		? `An error ${statusCode} occurred on server`
		: "An error occurred on client";

	return (
		<>
			<Head>
				<title>Something went wrong!</title>
				<link rel="icon" type="image/x-icon" href={logo} />
			</Head>
			<div className="error__container">
				<Link href="/">
					<a className="error__image">
						<Image src={image} alt="Cracked egg image" width="460" />
					</a>
				</Link>
				<h1 className="error__title">
					<p>{errorMessage}</p>
				</h1>
			</div>
		</>
	);
};

Error.getInitialProps = ({ res, err }: any) => {
	const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
	return { statusCode };
};

export default Error;

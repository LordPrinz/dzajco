import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import image from "./../public/404.svg";

export default function FourOhFour() {
	return (
		<>
			<Head>
				<title>404 Not Found</title>
				<link rel="icon" type="image/x-icon" href="logo.svg" />
			</Head>
			<div className="fourohfour__container">
				<Link href="/">
					<a className="fourohfour__image">
						<Image src={image} alt="Cracked egg image" width="530" />
					</a>
				</Link>
				<h1 className="fourohfour__title">Page Not Found</h1>
			</div>
		</>
	);
}

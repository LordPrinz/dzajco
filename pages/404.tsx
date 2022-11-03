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
			<div className="flex justify-center items-center h-[100vh] flex-col scale-75">
				<Link href="/">
					<a className="-translate-y-4">
						<Image src={image} alt="Cracked egg image" width="530" />
					</a>
				</Link>
				<h1 className="text-5xl mb-11 translate-y-10 font-extrabold  ml-10 tracking-widest text-[#1C1C1C]">
					Page Not Found
				</h1>
			</div>
		</>
	);
}

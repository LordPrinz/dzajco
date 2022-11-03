import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import image from "./../public/cracked_egg.svg";
export default function FourOhFour() {
	return (
		<>
			<Head>
				<title>404 Not Found</title>
			</Head>
			<div className="flex justify-center items-center h-[100vh] flex-col">
				<Link href="/">
					<a className="-translate-y-4">
						<Image src={image} alt="Cracked egg image" width="460" />
					</a>
				</Link>
				<h1 className="text-4xl mb-11  ml-10 tracking-widest">
					Page Not Found
				</h1>
			</div>
		</>
	);
}

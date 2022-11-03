import Link from "next/link";
import Image from "next/image";
import image from "./../public/cracked_egg.svg";
import Head from "next/head";
import logo from "./../public/logo.svg";
function Error({ statusCode }: { statusCode: number }) {
	return (
		<>
			<Head>
				<title>Something went wrong!</title>
				<link rel="icon" type="image/x-icon" href={logo} />
			</Head>
			<div className="flex justify-center items-center h-[100vh] flex-col">
				<Link href="/">
					<a className="-translate-y-4">
						<Image src={image} alt="Cracked egg image" width="460" />
					</a>
				</Link>
				<h1 className="text-4xl mb-11  ml-10 tracking-widest">
					<p>
						{statusCode
							? `An error ${statusCode} occurred on server`
							: "An error occurred on client"}
					</p>
				</h1>
			</div>
		</>
	);
}

Error.getInitialProps = ({ res, err }: any) => {
	const statusCode = res ? res.statusCode : err ? err.statusCode : 404;
	return { statusCode };
};

export default Error;

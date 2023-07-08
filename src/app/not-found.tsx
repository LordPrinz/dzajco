import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { GoHomeFill } from "react-icons/go";

export const metadata: Metadata = {
	title: "Not Found",
	description: "This page doesn't exist",
};

const NotFoundPage = () => {
	return (
		<main className="flex h-full w-full items-center justify-center ">
			<Link
				className="flex text-[#1C1C1C] font-bold absolute text-4xl top-5 left-4 gap-1.5  justify-center px-2 py-1"
				href="/">
				<GoHomeFill className="text-2xl" />{" "}
				<span className="text-lg -translate-y-0.5">Home</span>
			</Link>
			<Link className="" href="/">
				<div className="aspect-[4/3] relative ">
					<Image src="/404.svg" alt="Cracked egg image" fill={true} />
				</div>
				<h3 className="text-4xl font-extrabold  tracking-widest text-[#1C1C1C] text-center ">
					Page Not Found
				</h3>
			</Link>
		</main>
	);
};

export default NotFoundPage;

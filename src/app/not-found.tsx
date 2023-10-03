import HomeButton from "@/components/shared/HomeButton";
import { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Not Found",
	description: "This page doesn't exist",
};

const NotFoundPage = () => {
	return (
		<main className="flex h-full w-full items-center justify-center col-[center-start/center-end]">
			<HomeButton />
			<Link className="" href="/">
				<div className="aspect-[4/3] relative ">
					<Image src="/404.svg" alt="Cracked egg image" fill={true} />
				</div>
				<h3 className="text-4xl font-extrabold  tracking-widest text-[#1C1C1C] text-center ">
					No i co? <span className="text-jajco-500 px-1">Dżajco</span>
				</h3>
			</Link>
		</main>
	);
};

export default NotFoundPage;

import Link from "next/link";
import React from "react";
import { GoHomeFill } from "react-icons/go";

const HomeButton = () => {
	return (
		<Link
			className="flex text-[#1C1C1C] font-bold absolute text-4xl top-5 left-4 gap-1.5  justify-center px-2 py-1"
			href="/">
			<GoHomeFill className="text-xl md:text-2xl" />
			<span className="text-base md:text-lg -translate-y-0.5">Home</span>
		</Link>
	);
};

export default HomeButton;

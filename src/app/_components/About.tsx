import React from "react";
import Feature from "./Feature";
import { MdLogin } from "react-icons/md";

const About = () => {
	return (
		<section className="mt-44 flex flex-col">
			<h3 className="text-3xl  font-bold text-gray-00 text-center border-b pb-0 mb-12 max-w-3xl self-center w-full">
				<div className="translate-y-4 bg-light-bg-primary inline-block px-3 ">
					Why you should use <span className="text-jajco-500"> Dzajco</span>
				</div>
			</h3>
			<div className=" text-center w-full flex items-center justify-center">
				<p className=" text-gray-500 text-md max-w-2xl ">
					We understand the importance of simplicity and efficiency in your online
					endeavors. Our platform is designed to be your ultimate link shortening
					companion, offering a range of features that cater to both casual users and
					professionals alike.
				</p>
			</div>
			<div className="mt-16 grid grid-cols-4 gap-4">
				<Feature
					icon={<MdLogin />}
					title="No login"
					description="Forget the hassle of creating accounts. With dzajco, you can shorten your links instantly without the need for a login."
				/>
			</div>
		</section>
	);
};

export default About;

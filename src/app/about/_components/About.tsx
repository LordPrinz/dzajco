import React from "react";
import Feature from "../../_components/Feature";
import {
	MdBrush,
	MdDelete,
	MdHistory,
	MdLocationPin,
	MdOutlineLogin,
	MdOutlineTimelapse,
} from "react-icons/md";

const About = () => {
	return (
		<section className="mt-24 flex flex-col">
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
			<div className="my-16 grid sm:grid-cols-2  md:grid-cols-2 lg:grid-cols-3 gap-4">
				<Feature
					icon={<MdOutlineLogin />}
					title="No login required"
					description="Forget the hassle of creating accounts. With dzajco, you can shorten your links instantly without the need for a login."
				/>
				<Feature
					icon={<MdOutlineTimelapse />}
					title="Link Expiration"
					description="Take control of your links' lifespan. Set expiration dates to add an extra layer of security, perfect for time-sensitive promotions or temporary sharing needs.   "
				/>
				<Feature
					icon={<MdBrush />}
					title="Customized Link Names"
					description="Personalize your links with custom names or let our system auto-generate unique identifiers, ensuring your content stays uniquely yours."
				/>
				<Feature
					icon={<MdDelete />}
					title="Manual Link Deletion"
					description="Retract links at your discretion. Dzajco allows you to delete links manually, giving you full control over your content and its accessibility.          "
				/>
				<Feature
					icon={<MdLocationPin />}
					title="Visitor Tracking"
					description="Knowledge is power, especially when it comes to security. Track the number of visitors and their geographic locations effortlessly to stay informed about who engages with your content.          "
				/>
				<Feature
					icon={<MdHistory />}
					title="Link History"
					description="Keep your link management organized and secure with our comprehensive link history. Easily revisit, revise, or delete links as needed, knowing your content is in safe hands."
				/>
			</div>
		</section>
	);
};

export default About;

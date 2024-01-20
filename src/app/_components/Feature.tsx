import React from "react";

type FeatureProps = {
	title: string;
	icon: string | React.ReactNode;
	description: string;
};

const Feature = ({ icon, title, description }: FeatureProps) => {
	return (
		<div className="p-4 flex gap-3 items-start space-x-1">
			<span className="self-start text-jajco-500 text-4xl mt-1">{icon}</span>
			<div className="space-y-2">
				<h4 className="text-lg font-bold text-gray-700">{title}</h4>
				<p className="text-gray-500 text-sm leading-[21px]">{description}</p>
			</div>
		</div>
	);
};

export default Feature;

import React from "react";

type FeatureProps = {
	title: string;
	icon: string | React.ReactNode;
	description: string;
};

const Feature = ({}: FeatureProps) => {
	return <div className="p-4 border shadow-xs rounded-md">Feature</div>;
};

export default Feature;

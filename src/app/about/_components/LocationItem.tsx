import React from "react";

type Props = {
	location: string;
	visits: number;
};

const LocationItem = ({ location, visits }: Props) => {
	const correctForm = visits > 1 ? "visits" : "visit";

	return (
		<div className="text-center">
			<div className=" font-bold">{location}</div>
			<div className="text-sm  text-jajco-500">
				{visits} {correctForm}
			</div>
		</div>
	);
};

export default LocationItem;

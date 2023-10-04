import React from "react";

type Props = {
	location: string;
	visits: number;
};

const ChartItem = ({ location, visits }: Props) => {
	const correctForm = visits > 1 ? "visits" : "visit";

	return (
		<div>
			<div className="font-bold">{location}</div>
			<div className="text-sm  text-jajco-500">
				{visits} {correctForm}
			</div>
		</div>
	);
};

export default ChartItem;

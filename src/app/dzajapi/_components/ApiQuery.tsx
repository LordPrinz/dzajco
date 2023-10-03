import React from "react";

type Props = {
	data: {
		filed: string;
		type: string;
	}[];
};

const ApiQuery = ({ data }: Props) => {
	return (
		<div className="border relative bg-gray-100 border-gray-300">
			<pre className="text-gray-600 text-left p-4">
				{"{\n"}
				{data.map((d) => {
					return `  "${d.filed}": ${d.type}\n`;
				})}
				{"}"}
			</pre>
		</div>
	);
};

export default ApiQuery;

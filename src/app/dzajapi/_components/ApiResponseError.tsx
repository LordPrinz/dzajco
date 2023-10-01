import React from "react";

type Props = {
	status: number;
	data: {
		filed: string;
		type: string;
	}[];
};

const ApiResponseError = ({ status = 429, data }: Props) => {
	return (
		<div className="border relative bg-gray-100 border-gray-300">
			<div className="absolute top-2 right-6 text-sm text-gray-800">
				Status: <span className="font-bold">{status}</span>
				<div className="bg-red-500 w-2 h-2 rounded-full absolute top-1.5 -right-3"></div>
			</div>
			<pre className="text-gray-600 text-left p-4">
				{"{\n"}
				{data.map((d) => {
					return `  "${d.filed}": ${d.type}`;
				})}
				{"\n}"}
			</pre>
		</div>
	);
};

export default ApiResponseError;

import React from "react";

type Props = {
	method: "GET" | "POST" | "DELETE";
};

const ApiMethod = ({ method }: Props) => {
	return (
		<div className="bg-jajco-500 px-5 py-3 rounded-l-md text-jajco-50 select-none">
			{method}
		</div>
	);
};

export default ApiMethod;

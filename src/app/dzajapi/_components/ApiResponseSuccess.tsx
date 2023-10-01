import React from "react";

type Props = {
	status: number;
	data: {
		filed: string;
		type: string;
	}[];
};

const ApiResponseSuccess = ({ status = 200, data }: Props) => {
	return (
		<div>
			<div>xd</div>
			<pre></pre>
		</div>
	);
};

export default ApiResponseSuccess;

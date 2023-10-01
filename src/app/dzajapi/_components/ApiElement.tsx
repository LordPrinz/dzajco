import React from "react";
import ApiMethod from "./ApiMethod";

type Props = {
	name: string;
	endpoint: string;
	method: "GET" | "POST";
	children: React.ReactNode;
};

const ApiElement = ({ name, endpoint, method, children }: Props) => {
	return (
		<div className="w-full">
			<p>{name}</p>
			<div>
				<div>
					<ApiMethod method={method} />
					<div>{endpoint}</div>
				</div>
				<div>{children}</div>
			</div>
		</div>
	);
};

export default ApiElement;

"use client";

import React, { useState } from "react";
import ApiMethod from "./ApiMethod";

type Props = {
	name: string;
	endpoint: string;
	method: "GET" | "POST";
	children: React.ReactNode;
};

const ApiElement = ({ name, endpoint, method, children }: Props) => {
	const [visible, setVisible] = useState(false);

	const toggle = () => {
		setVisible((state) => !state);
	};

	return (
		<div className="w-full flex flex-col text-xl" onClick={toggle}>
			<p className="text-xl text-gray-800 text-left">{name}</p>
			<div className="mt-1.5">
				<div className="rounded-md flex items-center gap-4 bg-gray-100">
					<ApiMethod method={method} />
					<div className="text-gray-500">{endpoint}</div>
				</div>
				{visible && (
					<div className="p-2 text-lg space-y-3">
						<p className="text-gray-600 mt-2 text-left">Response</p>
						{children}
					</div>
				)}
			</div>
		</div>
	);
};

export default ApiElement;

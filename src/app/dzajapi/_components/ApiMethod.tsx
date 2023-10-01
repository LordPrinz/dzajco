import React from "react";

type Props = {
	method: "GET" | "POST";
};

const ApiMethod = ({ method }: Props) => {
	return <div>{method}</div>;
};

export default ApiMethod;

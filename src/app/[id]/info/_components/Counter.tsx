import React from "react";

type Props = {
	visits: number;
};

const Counter = ({ visits }: Props) => {
	return <div>{visits}</div>;
};

export default Counter;

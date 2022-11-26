import { FC } from "react";

type Props = {
	children: any;
};

const apiElement: FC<Props> = ({ children }) => {
	console.log("XD");

	return <div>{children}</div>;
};

export default apiElement;

import { FC } from "react";

type Props = {
	children: any;
	isShown: boolean;
};

const Expandable: FC<Props> = ({ children, isShown }) => {
	return <div>{isShown ? children : null}</div>;
};

export default Expandable;

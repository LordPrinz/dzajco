import { FC } from "react";

type Props = {
	children: any;
	isShown: boolean;
};

const Expandable: FC<Props> = ({ children, isShown }) => {
	return isShown ? <div className="expandable">{children}</div> : null;
};

export default Expandable;

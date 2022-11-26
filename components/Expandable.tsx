import { FC, useState } from "react";

type Props = {
	children: any;
};

const Expandable: FC<Props> = ({ children }) => {
	const [isShown, setIsShown] = useState(false);

	const clickHandler = () => {
		setIsShown((prevState) => !prevState);
	};

	return <div onClick={clickHandler}>{isShown ? children : null}</div>;
};

export default Expandable;

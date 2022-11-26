import { FC, useState } from "react";
import Expandable from "./Expandable";

type Props = {
	children: any;
	title: string;
	method: string;
	endpoint: string;
};

const apiElement: FC<Props> = ({ children, title, method, endpoint }) => {
	const [isShown, setIsShown] = useState(false);

	const clickHandler = () => {
		setIsShown((prevState) => !prevState);
	};

	return (
		<div>
			<h4 className="h4">{title}</h4>
			<div className="code" onClick={clickHandler}>
				<div className="apiMethod">{method.toUpperCase()}</div> {endpoint}
			</div>
			<Expandable isShown={isShown}>{children}</Expandable>
		</div>
	);
};

export default apiElement;

import { FC } from "react";

type Props = {
	children: any;
	title: string;
	method: string;
	endpoint: string;
};

const apiElement: FC<Props> = ({ children, title, method, endpoint }) => {
	return (
		<div>
			<h4 className="h4">{title}</h4>
			<div className="code">
				<div className="apiMethod">{method.toUpperCase()}</div> {endpoint}
			</div>
			{children}
		</div>
	);
};

export default apiElement;

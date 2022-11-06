import { FC } from "react";
import { SiEgghead } from "react-icons/si";

type Props = {
	number: number;
};

const Circle: FC<Props> = ({ number }) => {
	return (
		<div className="circle-card">
			<span className="circle-counter">{number}</span>
			<SiEgghead className="circle-icon" />
			<div className="circle-percent">
				<svg className="svg">
					<circle className="circle" cx="70" cy="70" r="70"></circle>
					<circle
						className={`circle circle-cover`}
						cx="70"
						cy="70"
						r="70"
					></circle>
				</svg>
			</div>
		</div>
	);
};

export default Circle;

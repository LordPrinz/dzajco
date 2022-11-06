import { SiEgghead } from "react-icons/si";

const Circle = ({ number }: { number: number }) => {
	return (
		<div className="circle-card">
			<span className="text-7xl absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 animate-fadeIn tablet:text-6xl">
				{number}
			</span>
			<SiEgghead className="text-5xl absolute left-1/2 -translate-x-1/2 -top-full  translate-y-1/4 z-10 bg-[#eee] px-1 animate-fill-egg tablet:text-4xl tablet:-top-1/2 tablet:-translate-y-1/4 tablet:px-0.5" />
			<div className="circle-percent">
				<svg className="svg">
					<circle className="circle" cx="70" cy="70" r="70"></circle>
					<circle
						className={`circle stroke-[#4762fb] [stroke-dasharray:440] animate-fill-circle `}
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

export type Props = {
	children: string;
	onClick: () => void;
	style?: "fill" | "outlined";
};

const Button = ({ children, onClick, style = "fill", ...props }: Props) => {
	const fillStyle = "bg-[#ffcc00] font-bold text-[#3b3a3a]";
	const outlinedStle = "border border-[#ffcc00] border-2 font-bold";

	return (
		<button
			onClick={onClick}
			className={`px-6 py-3 rounded-lg ${
				style === "fill" ? fillStyle : outlinedStle
			}`}>
			{children}
		</button>
	);
};

export default Button;

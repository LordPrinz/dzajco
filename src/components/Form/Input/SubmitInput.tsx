import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	title?: string;
};

const SubmitInput = ({ className, title }: Props) => {
	// return <input type="submit" className={cn("", className)} value={title} />;
	return (
		<div className="flex w-[calc(100%+24px)]">
			<input className="input flex-1 shadow" />
			<input
				type="submit"
				className="bg-jajco-500 text-jajco-50 pl-10 pr-6 rounded-r-full -translate-x-6 cursor-pointer shadow"
				value={"Dżajcuj"}
			/>
		</div>
	);
};

export default SubmitInput;

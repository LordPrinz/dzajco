import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	title?: string;
	placeholder?: string;
};

const SubmitInput = ({ className, title, placeholder }: Props) => {
	return (
		<div className={cn("flex w-[calc(100%+24px)]", className)}>
			<input className="input flex-1" placeholder={placeholder} />
			<input
				type="submit"
				className="bg-jajco-500 text-jajco-50 pl-10 pr-6 rounded-r-full -translate-x-6 cursor-pointer shadow"
				value={title}
			/>
		</div>
	);
};

export default SubmitInput;

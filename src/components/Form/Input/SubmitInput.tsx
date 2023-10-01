import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	title?: string;
	placeholder?: string;
	value: string;
	setValue: (value: string) => void;
};

const SubmitInput = ({
	className,
	title,
	placeholder,
	value,
	setValue,
}: Props) => {
	return (
		<div className={cn("flex w-[calc(100%+24px)]", className)}>
			<input
				className="input flex-1"
				placeholder={placeholder}
				value={value}
				onInput={(event) => setValue((event.target as HTMLInputElement).value)}
			/>
			<input
				type="submit"
				className="bg-jajco-500 text-jajco-50 pl-10 pr-6 rounded-r-full -translate-x-6 cursor-pointer shadow [text-shadow:_1px_1px_1px_rgb(0_0_0_/_14%)]"
				value={title}
			/>
		</div>
	);
};

export default SubmitInput;

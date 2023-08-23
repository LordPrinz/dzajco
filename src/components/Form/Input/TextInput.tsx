import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	placeholder?: string;
};

const TextInput = ({ className, placeholder }: Props) => {
	return (
		<div className={cn("flex w-[calc(100%+24px)]", className)}>
			<input className="input flex-1" placeholder={placeholder} />
		</div>
	);
};

export default TextInput;

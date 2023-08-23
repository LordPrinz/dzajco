import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	placeholder?: string;
	value: string;
	setValue: (value: string) => void;
};

const TextInput = ({ className, placeholder, value, setValue }: Props) => {
	return (
		<div className={cn("flex", className)}>
			<input
				className="input flex-1"
				placeholder={placeholder}
				value={value}
				onInput={(event) => setValue((event.target as HTMLInputElement).value)}
			/>
		</div>
	);
};

export default TextInput;

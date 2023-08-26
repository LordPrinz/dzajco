import SelectTimeInput from "./SelectTimeInput";
import SubmitInput from "./SubmitInput";
import TextInput from "./TextInput";

export type InputType = "text" | "datetime" | "submit";

export type Props = {
	type: InputType;
	className?: string;
	title?: string;
	placeholder?: string;
	value: string;
	setValue: (value: string) => void;
};

const Input = ({
	type,
	className,
	title,
	placeholder,
	setValue,
	value,
}: Props) => {
	if (type === "datetime") {
		return <SelectTimeInput value={value} setValue={setValue} />;
	}

	if (type === "submit") {
		return (
			<SubmitInput
				className={className}
				title={title}
				placeholder={placeholder}
				value={value}
				setValue={setValue}
			/>
		);
	}

	if (type === "text") {
		return (
			<TextInput
				className={className}
				placeholder={placeholder}
				value={value}
				setValue={setValue}
			/>
		);
	}
};

export default Input;

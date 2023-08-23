import SubmitInput from "./SubmitInput";
import TextInput from "./TextInput";

export type InputType = "text" | "datetime" | "submit";

export type Props = {
	type: InputType;
	className?: string;
	title?: string;
	placeholder?: string;
};

const Input = ({ type, className, title, placeholder }: Props) => {
	if (type === "datetime") {
	}

	if (type === "submit") {
		return (
			<SubmitInput className={className} title={title} placeholder={placeholder} />
		);
	}

	if (type === "text") {
		return <TextInput className={className} placeholder={placeholder} />;
	}
};

export default Input;

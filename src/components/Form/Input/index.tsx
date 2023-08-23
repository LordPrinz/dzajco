import { title } from "process";
import SubmitInput from "./SubmitInput";

export type InputType = "text" | "datetime" | "submit";

export type Props = {
	type: InputType;
	className?: string;
	title?: string;
};

const Input = ({ type, className }: Props) => {
	if (type === "datetime") {
	}

	if (type === "submit") {
		return <SubmitInput className={className} title={title} />;
	}

	if (type === "text") {
	}
};

export default Input;

"use client";

import { TMainFormAction } from "@/app/_actions/formActions";
import Input from "./Input";

type Props = {
	action: TMainFormAction;
};

const MainForm = ({ action }: Props) => {
	// const { setValue, value, error } = useInput({
	// 	validate(value) {
	// 		return isValidUrl(value);
	// 	},
	// });

	// const formHandler = (event: FormEvent<HTMLFormElement>) => {
	// 	event.preventDefault();
	// };

	// if (error) {
	// 	console.log("XD");
	// }

	return (
		<form
			action={action}
			className="overflow-hidden px-1 max-w-3xl my-10 mx-auto">
			<Input type="submit" title="Dżajcuj" placeholder="Link" />a
		</form>
	);
};

export default MainForm;

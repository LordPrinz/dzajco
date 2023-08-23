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
		<form action={action} className="bg-red-200">
			<Input />
		</form>
	);
};

export default MainForm;

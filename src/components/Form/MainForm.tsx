"use client";

import { TMainFormAction } from "@/app/_actions/formActions";
import Input from "./Input";
import Hidden from "../shared/Hidden";

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
			<Input type="submit" title="Dżajcuj" placeholder="Link" />
			<Hidden className="mt-4" text="More Options">
				saddassad
			</Hidden>
		</form>
	);
};

export default MainForm;

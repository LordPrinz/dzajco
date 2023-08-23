"use client";

import { TMainFormAction } from "@/app/_actions/formActions";

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
		<form action={action}>
			{/* <SubmitInput setValue={setValue} value={value} /> */}
		</form>
	);
};

export default MainForm;

"use client";

import useInput from "@/hooks/useInput";
import SubmitInput from "../Input/SubmitInput";

const MainForm = () => {
	const { setValue, value } = useInput({});

	const formHandler = () => {};
	return (
		<form>
			<SubmitInput
				setValue={setValue}
				value={value}
				formSubmitHandler={formHandler}
			/>
		</form>
	);
};

export default MainForm;

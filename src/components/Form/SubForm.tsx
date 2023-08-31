"use client";

import useInput from "@/hooks/useInput";
import Input from "./Input";

const SubForm = () => {
	const { value, setValue } = useInput({});

	const submitHandler = () => {};

	return (
		<form className="max-w-3xl mx-auto" onSubmit={submitHandler}>
			<h3 className="inline-block text-sm text-center text-gray-500 w-full mb-7 border-b pb-0.5">
				<div className="z-10 translate-y-1/2 px-2 bg-gray-50 inline-block">
					Link statistics
				</div>
			</h3>
			<Input
				type="submit"
				value={value}
				setValue={setValue}
				placeholder="Link or code"
				title="Show Statistics"
			/>
		</form>
	);
};

export default SubForm;

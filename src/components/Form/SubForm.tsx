"use client";

import useInput from "@/hooks/useInput";
import Input from "./Input";
import Notification from "../Notification";

const notification = new Notification();

const SubForm = () => {
	const { value, setValue } = useInput({});

	const submitHandler = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!value) {
			return notification.showError("You have to pass a short link or its code.");
		}

		let code;

		if (value.match("/")) {
			code = value.split("/")[3];
		} else {
			code = value;
		}

		const location = window.location.href.replace(
			/\.www|\/privacy-policy|\/dzajapi|\/history|\/about/g,
			""
		);

		const destination = `${location}${code}/info`;

		window.location.href = destination;
	};

	return (
		<form
			className="overflow-hidden px-1 max-w-3xl my-10 mb-5 mx-auto py-1"
			onSubmit={submitHandler}>
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
				className=""
			/>
		</form>
	);
};

export default SubForm;

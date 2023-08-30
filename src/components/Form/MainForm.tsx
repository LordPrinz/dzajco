"use client";

import { useState } from "react";
import Input from "./Input";
import Hidden from "../shared/Hidden";
import useInput from "@/hooks/useInput";

const MainForm = () => {
	const { value: link, setValue: setLink, error } = useInput({});

	const { value: customName, setValue: setCustomName } = useInput({});

	const { value: expirationValue, setValue: setExpirationValue } = useInput({
		initialValue: "never",
	});

	const { value: customExpirationValue, setValue: setCustomExpirationValue } =
		useInput({
			initialValue: "",
		});

	const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const response = await fetch("/api/urls", {
			method: "POST",
			body: JSON.stringify({ fullLink: "https://chat.openai.com/" }),
		});

		console.log(await response.json());
	};

	return (
		<form
			className="overflow-hidden px-1 max-w-3xl my-10 mx-auto py-1"
			onSubmit={submitHandler}>
			<Input
				type="submit"
				title="Dżajcuj"
				placeholder="Link"
				value={link}
				setValue={setLink}
			/>
			<Hidden className="mt-4 mb-2" text="More Options">
				<Input
					type="text"
					placeholder="Custom Name"
					value={customName}
					setValue={setCustomName}
					className="mb-5"
				/>
				<Input
					type="datetime"
					setValue={setExpirationValue}
					value={expirationValue}
					customValue={customExpirationValue}
					setCustomValue={setCustomExpirationValue}
				/>
			</Hidden>
		</form>
	);
};

export default MainForm;

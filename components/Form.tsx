import React, { useState } from "react";

const Form = () => {
	const [enteredUrl, setEnteredUrl] = useState("");
	const [customName, setCustomName] = useState("");
	const formSubmitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		console.log("XD");
		if (!enteredUrl) {
			return;
		}

		if (!customName) {
			const result = await fetch("/api/urls", {
				method: "POST",
				body: JSON.stringify({
					url: enteredUrl,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			});
			return;
		}

		const result = await fetch("/api/urls", {
			method: "POST",
			body: JSON.stringify({
				url: enteredUrl,
				customName,
			}),
			headers: {
				"Content-Type": "application/json",
			},
		});
	};

	const linkInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEnteredUrl(event.target.value);
	};

	const nameInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCustomName(event.target.value);
	};

	return (
		<form onSubmit={formSubmitHandler}>
			<input
				type="text"
				placeholder="Link"
				value={enteredUrl}
				onInput={linkInputHandler}
			/>
			<input
				type="text"
				placeholder="Custom Name"
				value={customName}
				onInput={nameInputHandler}
			/>
			<input type="submit" value="Skróć" />
		</form>
	);
};

export default Form;

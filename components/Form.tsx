import React, { useState } from "react";

const Form = () => {
	const [enteredUrl, setEnteredUrl] = useState("");

	const formSubmitHandler = (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
	};

	const inputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEnteredUrl(event.target.value);
	};

	return (
		<form onSubmit={formSubmitHandler}>
			<input
				type="text"
				placeholder="link"
				value={enteredUrl}
				onInput={inputHandler}
			/>
			<input type="submit" value="Skróć" />
		</form>
	);
};

export default Form;

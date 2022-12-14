import React, { useCallback, useState } from "react";
import Hidden from "./Hidden";
import showError from "../util/Notification/showError";
import promiseToast from "../util/Notification/promiseToast";
import isValidUrl from "../util/isValidUrl";

const Form = () => {
	const [enteredUrl, setEnteredUrl] = useState("");
	const [customName, setCustomName] = useState("");
	const [enteredLink, setEnteredLink] = useState("");

	const clearInputs = useCallback(() => {
		setEnteredUrl("");
		setCustomName("");
		setEnteredLink("");
	}, []);

	const formSubmitHandler = async (event: any) => {
		event.preventDefault();
		if (!enteredUrl) {
			return showError("You have to pass a valid link!");
		}

		if (!isValidUrl(enteredUrl)) {
			return showError("Invalid link provided!");
		}

		if (!customName) {
			promiseToast({
				url: enteredUrl,
				errorMessage: "Invalid link provided!",
			});

			return clearInputs();
		}

		if (customName.length > 25) {
			return showError(
				"Custom name is too long. Length should be not greater than 25"
			);
		}
		if (customName.match(/\s/g)) {
			return showError("Custom name should not contanin white spaces");
		}

		promiseToast({ url: enteredUrl, customName });

		clearInputs();
	};

	const linkInputHandler = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setEnteredUrl(event.target.value.trim());
	}, [enteredUrl]);

	const nameInputHandler = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setCustomName(event.target.value.trim());
	}, [customName]);

	const statsLinkInputHandler = useCallback((
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setEnteredLink(event.target.value.trim());
	}, [enteredLink]);

	const showCounterHandler = () => {
		if (enteredLink.trim().length === 0) {
			return;
		}

		window.location.href = `${enteredLink}/stats`;
	};

	return (
		<form className="form" onSubmit={(event) => event.preventDefault()}>
			<div className="flex">
				<input
					className="input input-main"
					type="text"
					placeholder="Link"
					value={enteredUrl}
					onInput={linkInputHandler}
				/>

				<input
					type="submit"
					value="D??ajcuj"
					className="submit-button"
					onClick={formSubmitHandler}
				/>
			</div>
			<Hidden>
				<input
					type="text"
					className="input"
					placeholder="Custom Name"
					value={customName}
					maxLength={25}
					onInput={nameInputHandler}
				/>

				<div className="flex mt-6">
					<input
						className="input input-main"
						type="text"
						placeholder="Short Link"
						value={enteredLink}
						onInput={statsLinkInputHandler}
					/>
					<input
						type="submit"
						value="Show Counter"
						className="submit-button"
						onClick={showCounterHandler}
					/>
				</div>
			</Hidden>
		</form>
	);
};

export default Form;

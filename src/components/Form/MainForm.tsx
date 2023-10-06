"use client";

import Input from "./Input";
import Hidden from "./Hidden";
import useInput from "@/hooks/useInput";
import Notification from "../Notification";

export type linkIn = {
	url: string;
	customName: string;
	expire: string;
};

const isValidUrl = (url: string) => {
	const urlPattern =
		/^(?:(?:https?|ftp|file):\/\/|www\.|ftp\.)(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[-A-Z0-9+&@#\/%=~_|$?!:,.])*(?:\([-A-Z0-9+&@#\/%=~_|$?!:,.]*\)|[A-Z0-9+&@#\/%=~_|$])/i;
	return urlPattern.test(url);
};

const calculateDateInFuture = (interval: string) => {
	const currentDate = new Date();
	const numericValue = +interval.slice(0, -1);
	const unit = interval.slice(-1);

	switch (unit) {
		case "d":
			currentDate.setDate(currentDate.getDate() + numericValue);
			break;
		case "h":
			currentDate.setHours(currentDate.getHours() + numericValue);
			break;
		case "m":
			currentDate.setMinutes(currentDate.getMinutes() + numericValue);
			break;
		default:
			throw new Error(`Invalid interval: ${interval}`);
	}

	return currentDate.toISOString();
};

const notification = new Notification();

const MainForm = () => {
	const {
		value: link,
		setValue: setLink,
		error: linkError,
		reset: linkReset,
	} = useInput({
		validate: (val: string) =>
			isValidUrl(val) && val.length > 6 && !val.includes("​"),
	});

	const {
		value: customName,
		setValue: setCustomName,
		error: customNameError,
		reset: customNameReset,
	} = useInput({
		validate: (val: string) => val.length <= 25,
	});

	const { value: expirationValue, setValue: setExpirationValue } = useInput({
		initialValue: "never",
	});

	const {
		value: customExpirationValue,
		setValue: setCustomExpirationValue,
		error: customExpirationDateError,
		reset: customExpirationValueReset,
	} = useInput({
		initialValue: "",
		validate: (val: number) => {
			const currentDate = new Date();
			currentDate.setMinutes(currentDate.getMinutes() + 10);
			const currentDateMilli = currentDate.getTime();
			const valDateMili = new Date(val).getTime();
			return currentDateMilli >= valDateMili;
		},
	});

	const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!link || !linkError) {
			return notification.showError("Invalid link provided!");
		}

		if (customName.includes("​")) {
			return (window.location.href =
				"https://www.youtube.com/watch?v=dQw4w9WgXcQ&ab_channel=RickAstley");
		}

		if (customName && !customNameError) {
			return notification.showError(
				"Custom name is too long. Length should be not greater than 25!"
			);
		}

		let expirationDate: string = "never";

		if (expirationValue !== "never") {
			if (expirationValue === "custom") {
				if (!customExpirationValue) {
					return notification.showError(
						"You have to specify custom expiration date!"
					);
				}

				if (customExpirationDateError) {
					return notification.showError(
						"Expiration date should be grater than 10 minutes from current time."
					);
				}

				expirationDate = customExpirationValue;
			} else {
				expirationDate = calculateDateInFuture(expirationValue);
			}
		}

		const linkToSave = {
			url: link,
			customName,
			expire: expirationDate,
		};

		notification.promise(linkToSave);

		linkReset();
		customNameReset();
		customExpirationValueReset();
		setExpirationValue("never");
	};

	return (
		<form
			className="overflow-hidden px-1 max-w-3xl my-10 mb-5 mx-auto py-1"
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

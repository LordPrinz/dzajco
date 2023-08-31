"use client";

import Input from "./Input";
import Hidden from "../shared/Hidden";
import useInput from "@/hooks/useInput";
import Notification from "../Notification";
import { expireTime } from "./Input/SelectTimeInput";

//? had to repeat cuz of hydration error, idk how to fix

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
			// Handle invalid interval strings here
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
	} = useInput({
		validate: (val: string) => isValidUrl(val) && val.length > 6,
	});

	const {
		value: customName,
		setValue: setCustomName,
		error: customNameError,
	} = useInput({
		validate: (val: string) => val.length <= 25,
	});

	const { value: expirationValue, setValue: setExpirationValue } = useInput({
		initialValue: "never",
	});

	const { value: customExpirationValue, setValue: setCustomExpirationValue } =
		useInput({
			initialValue: "",
		});

	const submitHandler = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		if (!link || !linkError) {
			return notification.showError("Invalid link provided!");
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

				expirationDate = customExpirationValue;
			} else {
				expirationDate = calculateDateInFuture(expirationValue);
			}
		}

		console.log(expirationDate);

		notification.promise({ url: link, customName, expire: expirationDate });
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

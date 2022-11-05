import React, { useState } from "react";
import Hidden from "./Hidden";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import LinkCopier from "./LinkCopier";
import copy from "../util/copy";
import { useRouter } from "next/router";

const Form = () => {
	const router = useRouter();

	const [enteredUrl, setEnteredUrl] = useState("");
	const [customName, setCustomName] = useState("");
	const [enteredLink, setEnteredLink] = useState("");

	const clearInputs = () => {
		setEnteredUrl("");
		setCustomName("");
		setEnteredLink("");
	};

	const formSubmitHandler = async (event: any) => {
		event.preventDefault();

		if (!enteredUrl) {
			toast("You have to pass a valid link!", {
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				type: "error",
			});
			return;
		}

		if (!customName) {
			const response = await toast.promise(
				fetch("/api/urls", {
					method: "POST",
					body: JSON.stringify({
						url: enteredUrl,
					}),
					headers: {
						"Content-Type": "application/json",
					},
				}).then(async (data) => {
					if (data.status === 201) {
						data.json().then((d) => {
							toast(<LinkCopier url={d.shortUrl} />, {
								type: "success",
								autoClose: 15000,
								style: { background: "rgb(229 231 235)" },
								onClose: () => {
									copy(`${window.location.href}${d.shortUrl}`);
								},
							});
						});
					}
					if (data.status === 429) {
						data.json().then((d) => {
							toast(d.error, {
								type: "error",
								autoClose: 5000,
							});
						});
						return;
					}
					return data.status !== 201 && Promise.reject(await data.json());
				}),
				{
					pending: "Loading...",
					error: "Invalid link provided!",
				}
			);

			return;
		}

		if (customName.length > 25) {
			toast("Custom name is too long. Length should be not greater than 25", {
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				type: "error",
			});
			return;
		}
		if (customName.match(/\s/g)) {
			toast("Custom name should not contanin white spaces", {
				autoClose: 5000,
				closeOnClick: true,
				pauseOnHover: true,
				draggable: true,
				type: "error",
			});
			return;
		}
		const response = await toast.promise(
			fetch("/api/urls", {
				method: "POST",
				body: JSON.stringify({
					url: enteredUrl,
					customName,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}).then(async (data) => {
				if (data.status === 201) {
					data.json().then((d) => {
						toast(<LinkCopier url={d.shortUrl} />, {
							type: "success",
							autoClose: 150000,
							onClick: () => {
								copy(`${window.location.href}${d.shortUrl}`);
							},
							style: { background: "rgb(229 231 235)" },
						});
					});
				}
				if (data.status === 422) {
					data.json().then((d) => {
						toast(d.message, {
							type: "error",
							autoClose: 5000,
						});
					});
					return;
				}

				if (data.status === 429) {
					data.json().then((d) => {
						toast(d.error, {
							type: "error",
							autoClose: 5000,
						});
					});
					return;
				}

				return data.status !== 201 && Promise.reject(await data.json());
			}),
			{
				pending: "Loading...",
				error: "An error has occured",
			}
		);

		clearInputs();
	};

	const linkInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEnteredUrl(event.target.value.trim());
	};

	const nameInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCustomName(event.target.value.trim());
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
					value="Dżajcuj"
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

				<div className="flex  mt-10">
					<input
						className="input input-main"
						type="text"
						placeholder="Short Link"
						value={enteredLink}
						onInput={(event: React.ChangeEvent<HTMLInputElement>) => {
							setEnteredLink(event.target.value.trim());
						}}
					/>
					<input
						type="submit"
						value="Show Counter"
						className="submit-button"
						onClick={() => {
							if (enteredLink.trim().length === 0) {
								return;
							}

							window.location.href = `${enteredLink}/stats`;
						}}
					/>
				</div>
			</Hidden>
		</form>
	);
};

export default Form;

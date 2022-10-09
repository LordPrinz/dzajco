import React, { useState } from "react";
import Hidden from "./Hidden";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { AiOutlineCopy } from "react-icons/ai";
const Form = () => {
	const [enteredUrl, setEnteredUrl] = useState("");
	const [customName, setCustomName] = useState("");

	const clearInputs = () => {
		setEnteredUrl("");
		setCustomName("");
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
			const id = toast.loading("Loading...", {
				autoClose: 10000,
			});

			const response = await fetch("/api/urls", {
				method: "POST",
				body: JSON.stringify({
					url: enteredUrl,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			}).then(async (response) => {
				return { data: await response.json(), code: response.status };
			});
			if (response.code === 201) {
				toast.update(id, {
					render: (
						<div className="flex justify-between items-center px-2 py-3 mr-3  rounded-md">
							<span>{response.data.shortUrl}</span>
							<AiOutlineCopy
								className="text-xl"
								onClick={() =>
									navigator.clipboard.writeText(`http://localhost:3000/${response.data.shortUrl}`)
								}
							/>
						</div>
					),
					type: "success",
					autoClose: 10000,
					pauseOnHover: true,
					isLoading: false,
					closeButton: true,
				});
			} else {
				toast.update(id, {
					render: response.data.message,
					type: "error",
					autoClose: 3000,
					closeOnClick: true,
					pauseOnHover: true,
					draggable: true,
					isLoading: false,
					closeButton: true,
				});
			}
			clearInputs();
			return;
		}

		const response = await fetch("/api/urls", {
			method: "POST",
			body: JSON.stringify({
				url: enteredUrl,
				customName,
			}),
			headers: {
				"Content-Type": "application/json",
			},
		}).then((response) => response.json());

		console.log(response);
		clearInputs();
	};

	const linkInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setEnteredUrl(event.target.value);
	};

	const nameInputHandler = (event: React.ChangeEvent<HTMLInputElement>) => {
		setCustomName(event.target.value);
	};

	return (
		<form className="form" onSubmit={(event) => event.preventDefault()}>
			<div className="flex">
				<input
					className="input"
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
					onInput={nameInputHandler}
				/>
			</Hidden>
		</form>
	);
};

export default Form;

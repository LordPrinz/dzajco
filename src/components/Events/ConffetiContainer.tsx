"use client";

import { cn } from "@/utils/tailwind";
import React, { useEffect, useState } from "react";
import Confetti from "react-confetti";

type Props = {
	isText: boolean;
};

const ConffetiContainer = ({ isText }: Props) => {
	const [isRendered, setIsRendered] = useState(false);

	const [isConffeti, setIsConffeti] = useState(true);

	const [fadeOutConffeti, setFadeOutConffeti] = useState(false);

	useEffect(() => {
		setIsRendered(true);
	}, []);

	useEffect(() => {
		setTimeout(() => {
			setIsConffeti(false);
		}, 6000);
	}, []);

	useEffect(() => {
		setTimeout(() => {
			setFadeOutConffeti(true);
		}, 5000);
	});

	return (
		<>
			{isRendered && isConffeti && (
				<>
					<Confetti
						className={cn(
							"opacity-100 transition duration-1000",
							fadeOutConffeti ? "opacity-0 transition" : ""
						)}
						width={window.innerWidth}
					/>
					{isText && (
						<div
							className={cn(
								"absolute -ml-40 mt-1 top-44 left-1/2  text-3xl -rotate-12 font-bold text-jajco-500",
								"transition duration-1000 animate-bounce",
								fadeOutConffeti
									? "opacity-0 transition"
									: "opacity-100 transition duration-1000"
							)}>
							Happy dzajnniversary!
						</div>
					)}
				</>
			)}
		</>
	);
};

export default ConffetiContainer;

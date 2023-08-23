"use client";

import { useState } from "react";
import { AiFillCaretRight } from "react-icons/ai";

type Props = {
	text: string;
	children: React.ReactNode;
};

const Hidden = ({ children, text }: Props) => {
	const [isShown, setIsShown] = useState(false);

	const arrowRotate = isShown ? "rotate-90" : "";

	const hiddenButtonHandler = () => {
		setIsShown((prevState) => !prevState);
	};

	return (
		<>
			<button
				className="mt-4 mb-4 ml-2 self-start py-2"
				onClick={hiddenButtonHandler}>
				<span className="flex items-center gap-1.5 text-sm">
					<AiFillCaretRight className={`${arrowRotate} transition`} />
					{text}
				</span>
			</button>
			{isShown && children}
		</>
	);
};

export default Hidden;

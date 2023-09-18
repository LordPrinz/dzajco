"use client";

import { cn } from "@/utils/tailwind";
import { useState } from "react";
import { AiFillCaretRight } from "react-icons/ai";

type Props = {
	text: string;
	children: React.ReactNode;
	className?: string;
};

const Hidden = ({ children, text, className }: Props) => {
	const [isShown, setIsShown] = useState(false);

	const arrowRotate = isShown ? "rotate-90" : "";

	const hiddenButtonHandler = () => {
		setIsShown((prevState) => !prevState);
	};

	return (
		<>
			<button
				type="button"
				className={cn("self-start py-2 cursor-pointer inline-block", className)}
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

import { copy } from "@/components/Notification";
import { useCallback, useEffect, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";

type Props = {
	url: string;
	code?: string;
};

const Copy = ({ url, code }: Props) => {
	const [isClicked, setIsClicked] = useState(false);

	useEffect(() => {
		if (isClicked === true) {
			setTimeout(() => {
				setIsClicked(false);
			}, 5000);
		}
	}, [isClicked]);

	const copyHandler = useCallback(() => {
		copy(url);
		setIsClicked(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const icon = isClicked ? (
		<AiOutlineCheck
			size={20}
			className={`absolute right-0  z-10`}
			onClick={copyHandler}
		/>
	) : (
		<AiOutlineCopy
			size={20}
			className=" absolute right-0 z-10"
			onClick={copyHandler}
		/>
	);

	return (
		<div
			className="flex items-center justify-between pr-5 h-full relative hover:text-jajco-600 transition hover:transition"
			onClick={copyHandler}>
			<span className="mr-2 cursor-pointer">{code}</span>
			{icon}
		</div>
	);
};

export default Copy;

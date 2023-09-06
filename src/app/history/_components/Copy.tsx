import { useCallback, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";

type Props = {
	url: string;
};

const Copy = ({ url }: Props) => {
	const [isClicked, setIsClicked] = useState(false);

	const copyHandler = useCallback(() => {
		setIsClicked(true);
	}, []);

	const icon = isClicked ? (
		<AiOutlineCheck
			size={20}
			className={`transition hover:text-gray-600 hover:transition absolute right-0  z-10`}
			onClick={copyHandler}
		/>
	) : (
		<AiOutlineCopy
			size={20}
			className="transition hover:text-gray-600 hover:transition absolute right-0 z-10"
			onClick={copyHandler}
		/>
	);

	return (
		<div
			className="flex items-center justify-between pr-5 h-full relative"
			onClick={copyHandler}>
			{icon}
		</div>
	);
};

export default Copy;

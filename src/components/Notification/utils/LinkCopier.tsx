import { useCallback, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";

type Props = {
	url: string;
};

const LinkCopier = ({ url }: Props) => {
	const [isClicked, setIsClicked] = useState(false);

	const copyHandler = useCallback(() => {
		setIsClicked(true);
	}, []);

	const icon = isClicked ? (
		<AiOutlineCheck
			size={25}
			className={`transition hover:text-gray-600 hover:transition absolute right-0 bg-gray-100  z-10`}
			onClick={copyHandler}
		/>
	) : (
		<AiOutlineCopy
			size={25}
			className="transition hover:text-gray-600 hover:transition absolute right-0 bg-gray-100 z-10"
			onClick={copyHandler}
		/>
	);

	const link = `https://www.dzaj.de/${decodeURIComponent(url)}`;

	return (
		<div
			className="flex items-center justify-between pr-5 h-full relative w-full"
			onClick={copyHandler}>
			<div className="absolute w-full overflow-hidden">{link}</div>
			{icon}
		</div>
	);
};

export default LinkCopier;

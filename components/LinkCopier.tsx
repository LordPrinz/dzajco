import { useCallback, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";

const LinkCopier = ({ url }: { url: string }) => {
	const [isClicked, setIsClicked] = useState(false);

	const copyHandler = useCallback(() => {
		setIsClicked(true);
	}, [url]);

	return (
		<div className={`notification relative w-full`} onClick={copyHandler}>
			<div className="notification-link absolute w-full overflow-hidden">{`${window.location.href}${url}`}</div>
			{isClicked ? (
				<AiOutlineCheck
					size={25}
					className={`notification-icon absolute right-0 bg-[#e5e7eb]  z-10`}
					onClick={copyHandler}
				/>
			) : (
				<AiOutlineCopy
					size={25}
					className={`notification-icon absolute right-0 bg-[#e5e7eb]  z-10`}
					onClick={copyHandler}
				/>
			)}
		</div>
	);
};

export default LinkCopier;

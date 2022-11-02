import { useCallback, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";
import copy from "../util/copy";

const LinkCopier = ({ url }: { url: string }) => {
	const [isClicked, setIsClicked] = useState(false);

	const copyHandler = useCallback(() => {
		copy(`${window.location.href}${url}`);
		setIsClicked(true);
	}, [url]);

	return (
		<div className={`notification`} onClick={copyHandler}>
			<div className="notification-link">{url}</div>
			{isClicked ? (
				<AiOutlineCheck
					size={25}
					className={`notification-icon`}
					onClick={copyHandler}
				/>
			) : (
				<AiOutlineCopy
					size={25}
					className={`notification-icon`}
					onClick={copyHandler}
				/>
			)}
		</div>
	);
};

export default LinkCopier;

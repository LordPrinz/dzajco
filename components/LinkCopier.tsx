import { useCallback, useState } from "react";
import { AiOutlineCheck, AiOutlineCopy } from "react-icons/ai";

const LinkCopier = ({ url }: { url: string }) => {
	const [isClicked, setIsClicked] = useState(false);

	const copyHandler = useCallback(() => {
		setIsClicked(true);
	}, [url]);

	return (
		<div className={`notification`} onClick={copyHandler}>
			<div className="notification-link">{`${window.location.href}${url}`}</div>
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

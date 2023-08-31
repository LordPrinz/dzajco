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
			className={`notification-icon`}
			onClick={copyHandler}
		/>
	) : (
		<AiOutlineCopy
			size={25}
			className={`notification-icon`}
			onClick={copyHandler}
		/>
	);

	const link = `${window.location.href}${url}`;

	return (
		<div className={`notification`} onClick={copyHandler}>
			<div className="notification-link">{link}</div>
			{icon}
		</div>
	);
};

export default LinkCopier;

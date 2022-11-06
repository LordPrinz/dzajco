import { FC, useState } from "react";
import { AiFillCaretRight } from "react-icons/ai";

type Props = {
	children: React.ReactNode;
};

const Hidden: FC<Props> = ({ children }) => {
	const [isShown, setIsShown] = useState(false);

	const arrowRotate = isShown ? "rotate-90" : "";

	const hiddenButtonHandler = () => {
		setIsShown((prevState) => !prevState);
	};

	return (
		<>
			<button className="hidden__button" onClick={hiddenButtonHandler}>
				<span className="hidden-description">
					<AiFillCaretRight className={`${arrowRotate} transition`} />
					More Options
				</span>
			</button>
			{isShown && children}
		</>
	);
};

export default Hidden;

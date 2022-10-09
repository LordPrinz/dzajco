import { useState } from "react";
import { AiFillCaretRight } from "react-icons/ai";
const Hidden = ({ children }: { children: React.ReactNode }) => {
	const [isShownm, setIsShown] = useState(false);

	return (
		<>
			<button
				className="mt-4 mb-4 ml-2 self-start py-2"
				onClick={() => {
					setIsShown((prevState) => !prevState);
				}}
			>
				<span className="hidden-description">
					<AiFillCaretRight />
					Więcej opcji
				</span>
			</button>
			{isShownm && children}
		</>
	);
};

export default Hidden;

import { useState } from "react";

const Hidden = ({ children }: { children: React.ReactNode }) => {
	const [isShownm, setIsShown] = useState(false);

	return (
		<>
			<button
				className="mt-4 mb-4 ml-2 self-start px-4 py-2"
				onClick={() => {
					setIsShown((prevState) => !prevState);
				}}
			>
				Ustaw własną nazwę
			</button>
			{isShownm && children}
		</>
	);
};

export default Hidden;

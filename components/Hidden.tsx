import { useState } from "react";

const Hidden = ({ children }: { children: React.ReactNode }) => {
	const [isShownm, setIsShown] = useState(false);

	return <>{isShownm && children}</>;
};

export default Hidden;

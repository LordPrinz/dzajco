import { useRouter } from "next/router";
import { AiOutlineArrowLeft } from "react-icons/ai";

const goBackButton = () => {
	const router = useRouter();

	const backButtonHandler = () => {
		router.back();
	};
	return (
		<AiOutlineArrowLeft
			className="stats__backButton"
			onClick={backButtonHandler}
		/>
	);
};

export default goBackButton;

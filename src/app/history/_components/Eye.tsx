import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

type Props = {
	isVisible: boolean;
	setIsVisible: (args?: any) => void;
};

const Eye = ({ isVisible, setIsVisible }: Props) => {
	const toggle = () => {
		setIsVisible((prevState: boolean) => !prevState);
	};

	return (
		<>
			{isVisible ? (
				<AiOutlineEye onClick={toggle} />
			) : (
				<AiOutlineEyeInvisible onClick={toggle} />
			)}
		</>
	);
};

export default Eye;

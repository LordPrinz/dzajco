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
				<AiOutlineEye className="cursor-pointer" onClick={toggle} />
			) : (
				<AiOutlineEyeInvisible onClick={toggle} className="cursor-pointer" />
			)}
		</>
	);
};

export default Eye;

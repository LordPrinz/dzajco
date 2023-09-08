import { AiOutlineEye, AiOutlineEyeInvisible } from "react-icons/ai";

type Props = {
	isShow: boolean;
	setIsShow: (args?: any) => void;
};

const ShowLink = ({ isShow, setIsShow }: Props) => {
	const toggle = () => {
		setIsShow((prevState: boolean) => !prevState);
	};

	return (
		<>
			{isShow ? (
				<AiOutlineEye onClick={toggle} />
			) : (
				<AiOutlineEyeInvisible onClick={toggle} />
			)}
		</>
	);
};

export default ShowLink;

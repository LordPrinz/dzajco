import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	title?: string;
};

const SubmitInput = ({ className, title }: Props) => {
	return <input className={cn("", className)} value={title} />;
};

export default SubmitInput;

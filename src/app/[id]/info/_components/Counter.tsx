import { cn } from "@/utils/tailwind";
import React from "react";

type Props = {
	visits: number;
	className?: string;
};

const Counter = ({ visits, className }: Props) => {
	return (
		<div className={cn("", className)}>
			<div className="w-52 h-28 rounded-tl-full border-[6px] border-jajco-500 rounded-tr-full border-b-0 relative">
				<span className="absolute top-1/2 left-1/2 -translate-x-1/2 text-3xl font-bold translate-y-1">
					{visits}
				</span>
			</div>
		</div>
	);
};

export default Counter;

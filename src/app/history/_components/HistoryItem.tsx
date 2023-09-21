"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import { Link } from "@/types/localStorage";
import { MdDelete } from "react-icons/md";
import Copy from "./Copy";
import { cn } from "@/utils/tailwind";
import { useState } from "react";
import Eye from "./Eye";

type Props = {
	action: (id: string, secretKey: string) => Promise<void>;
	data: Link;
	removeItemLocal: (id: string) => void;
};

const HistoryItem = ({ action, data, removeItemLocal }: Props) => {
	const [storedValue, setValue] = useLocalStorage("links-history", []);
	const [isVisible, setIsVisible] = useState(false);

	const link = `https://www.dzaj.de/${decodeURIComponent(data.id)}`;

	return (
		<div className="flex items-center justify-between relative max-w-2xl w-full mx-auto ">
			<div className="flex flex-col gap-1">
				<div className="text-xl text-jajco-500 flex items-center gap-3">
					<Copy url={link} code={decodeURIComponent(data.id)} />
				</div>
				<div className="flex justify-between w-full ">
					<span className="min-w-[16px]">
						<Eye isVisible={isVisible} setIsVisible={setIsVisible} />
					</span>
					<span
						className={cn(
							"text-xs text-slate-500 pr-2 pl-2",
							!isVisible && "history_item__fullLink max-w-xs"
						)}>
						{data.url}
					</span>
				</div>
			</div>
			{data.secretKey && (
				<button
					className="p-1.5 rounded px-2 bg-red-500 text-jajco-50 flex items-center gap-1 text-xs"
					formAction={() => {
						const stateToSave = storedValue.filter((val: Link) => val.id !== data.id);
						setValue(stateToSave);
						removeItemLocal(data.id);
						action(data.id, data.secretKey!);
					}}>
					Delete <MdDelete className="text-xs" />
				</button>
			)}
		</div>
	);
};

export default HistoryItem;

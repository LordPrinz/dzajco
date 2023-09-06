"use client";

import { copy } from "@/components/Notification";
import useLocalStorage from "@/hooks/useLocalStorage";
import { Link } from "@/types/localStorage";
import {MdDelete} from "react-icons/md";
import Copy from "./Copy";

type Props = {
	action: (id: string) => Promise<void>;
	data: Link;
	removeItemLocal: (id: string) => void
};

const HistoryItem = ({ action, data, removeItemLocal }: Props) => {
	const [storedValue, setValue] = useLocalStorage("links-history", []);

	const copyLink = `${window.location.href.replace("history", "")}${data.id}`

	return (
		<div className="flex items-center justify-between relative max-w-2xl w-full mx-auto">
			<div className="flex flex-col gap-1">
				<div className="text-xl text-jajco-600 flex items-center gap-3" onClick={() => {
					copy(copyLink)
				}}>{data.id} <Copy url={copyLink}/></div>
				<span className="text-xs text-slate-500">{data.url}</span>
			</div>
		<button
		className="p-2 rounded-xl px-3 bg-red-500 text-jajco-50 flex items-center gap-1 text-sm"
			formAction={() => {
				const stateToSave = storedValue.filter((val: Link) => val.id !== data.id);
				setValue(stateToSave);
				removeItemLocal(data.id)
				action(data.id);
			}}>
			Delete <MdDelete className="text-base"/>
		</button>
		</div>
	);
};

export default HistoryItem;

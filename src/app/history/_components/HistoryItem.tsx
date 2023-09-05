"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import { Link } from "@/types/localStorage";

type Props = {
	action: (id: string) => Promise<void>;
	data: Link;
};

const HistoryItem = ({ action, data }: Props) => {
	const [storedValue, setValue] = useLocalStorage("links-history", []);

	return (
		<button
			formAction={() => {
				const stateToSave = storedValue.filter((val: Link) => val.id !== data.id);
				setValue(stateToSave);

				action(data.id);
			}}>
			{data.id}
		</button>
	);
};

export default HistoryItem;

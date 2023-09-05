"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import HistoryItem from "./HistoryItem";

type Props = {
	action: (id: string) => Promise<void>;
};

const History = ({ action }: Props) => {
	const [storedValue, setValue] = useLocalStorage("links-history", []);

	console.log(storedValue);

	return (
		<form>
			<HistoryItem action={action} id="xd" />
		</form>
	);
};

export default History;

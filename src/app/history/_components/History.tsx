"use client";

import useLocalStorage from "@/hooks/useLocalStorage";
import HistoryItem from "./HistoryItem";
import { Link } from "@/types/localStorage";
import { useEffect, useState } from "react";

type Props = {
	action: (id: string) => Promise<void>;
};

const History = ({ action }: Props) => {
	const [storedValue, setValue] = useLocalStorage("links-history", []);

	// Hydration error fix
	const [domLoaded, setDomLoaded] = useState(false);

	useEffect(() => {
		setDomLoaded(true);
	}, []);

	return (
		<>
			{domLoaded && (
				<form className="mt-16  space-y-6 ">
					{storedValue.map((element: Link) => (
						<HistoryItem action={action} data={element}  key={`${element.createdAt}-${element.id}`}/>
					))}
				</form>
			)}
		</>
	);
};

export default History;

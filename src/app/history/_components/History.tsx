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

	const removeItemLocal = (id: string) => {
		setValue((prevState: Link[]) => prevState.filter((link) => link.id !== id));
	};

	return (
		<>
			{domLoaded && (
				<form className="mt-14  space-y-6 pb-7 ">
					{storedValue.length === 0 && (
						<div className="text-center text-2xl font-bold">No links found.</div>
					)}
					{storedValue.map((element: Link) => (
						<HistoryItem
							removeItemLocal={removeItemLocal}
							action={action}
							data={element}
							key={`${element.createdAt}-${element.id}`}
						/>
					))}
				</form>
			)}
		</>
	);
};

export default History;

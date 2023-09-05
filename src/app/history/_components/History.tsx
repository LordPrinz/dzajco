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
				<form className="">
					{storedValue.map((element: Link) => (
						<div key={`${element.createdAt}-${element.id}`}>
							<HistoryItem action={action} data={element} />
						</div>
					))}
				</form>
			)}
		</>
	);
};

export default History;

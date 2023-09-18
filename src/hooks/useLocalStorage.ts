"use client";

import { useState } from "react";

type SetValue = (value: any | ((prevValue: any) => any)) => void;

const useLocalStorage = (key: string, initialValue: any): [any, SetValue] => {
	const [storedValue, setStoredValue] = useState(() => {
		try {
			if (typeof window !== "undefined") {
				const item = window.localStorage.getItem(key);
				return item ? JSON.parse(item) : initialValue;
			}
			return initialValue;
		} catch (error) {
			console.log(error);
			return initialValue;
		}
	});

	const setValue: SetValue = (value) => {
		try {
			const valueToStore =
				value instanceof Function ? (value as Function)(storedValue) : value;

			setStoredValue(valueToStore);

			if (typeof window !== "undefined") {
				window.localStorage.setItem(key, JSON.stringify(valueToStore));
			}
		} catch (error) {
			console.log(error);
		}
	};

	return [storedValue, setValue];
};

export default useLocalStorage;

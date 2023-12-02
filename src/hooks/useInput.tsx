"use client";

import { useState, useEffect } from "react";

interface UseInputProps {
	initialValue?: string;
	validate?: (val: any) => boolean;
}

interface UseInputReturn {
	value: string;
	setValue: (value: string) => void;
	reset: () => void;
	error: boolean;
}

const useInput = ({
	initialValue = "",
	validate,
}: UseInputProps): UseInputReturn => {
	const [value, setValue] = useState<string>(initialValue);
	const [error, setError] = useState<boolean>(false);

	const reset = (): void => {
		setValue(initialValue);
		setError(false);
	};

	useEffect(() => {
		if (!validate) {
			return;
		}

		setError(validate(value));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [value]);

	return {
		value,
		reset,
		setValue,
		error,
	};
};

export default useInput;

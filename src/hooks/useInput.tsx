"use client";

import { useState, useEffect } from "react";

//TODO: Fix Validate Function

interface UseInputProps {
	initialValue?: string;
	validate?: (value?: string) => string | null;
}

interface UseInputReturn {
	value: string;
	setValue: (value: string) => void;
	reset: () => void;
	error: string | null;
}

const useInput = ({
	initialValue = "",
	validate,
}: UseInputProps): UseInputReturn => {
	const [value, setValue] = useState<string>(initialValue);
	const [error, setError] = useState<string | null>(null);

	const reset = (): void => {
		setValue(initialValue);
		setError(null);
	};

	useEffect(() => {
		if (!validate) {
			return;
		}

		const error = validate(value);

		if (error) {
			setValue(error);
		}
	}, [value]);

	return {
		value,
		reset,
		setValue,
		error,
	};
};

export default useInput;

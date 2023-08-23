"use client";

import { useState } from "react";

interface UseInputProps {
	initialValue?: string;
	validate?: (value: string) => boolean;
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

	return {
		value,
		reset,
		setValue,
		error,
	};
};

export default useInput;

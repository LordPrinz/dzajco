import { useState, ChangeEvent } from "react";

interface UseInputProps {
	initialValue?: string;
	validate?: (value: string) => boolean;
}

interface UseInputReturn {
	value: string;
	onChange: (event: ChangeEvent<HTMLInputElement>) => void;
	reset: () => void;
	error: string | null;
}

const useInput = ({
	initialValue = "",
	validate,
}: UseInputProps): UseInputReturn => {
	const [value, setValue] = useState<string>(initialValue);
	const [error, setError] = useState<string | null>(null);

	const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
		setValue(event.target.value);
		if (validate) {
			const isValid = validate(event.target.value);
			setError(isValid ? null : "Invalid value");
		}
	};

	const reset = (): void => {
		setValue(initialValue);
		setError(null);
	};

	return {
		value,
		onChange: handleChange,
		reset,
		error,
	};
};

export default useInput;

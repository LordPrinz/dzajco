import React from "react";
import { cn } from "@/utils/tailwind";

type Props = {
	className?: string;
	value: string;
	setValue: (value: string) => void;
	setCustomValue?: (value: string) => void;
	customValue?: string;
};

export type expireTime =
	| "7d"
	| "1d"
	| "12m"
	| "6h"
	| "1h"
	| "45m"
	| "30m"
	| "20m"
	| "15m"
	| "10m"
	| "never"
	| Date;

const SelectTimeInput = ({
	value,
	setValue,
	className,
	customValue,
	setCustomValue,
}: Props) => {
	const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
		const selectedValue = event.target.value;
		setValue(selectedValue);
	};

	return (
		<>
			<div className="relative flex w-full">
				<div className="h-full shadow bg-jajco-500 px-6 rounded-l-full py-4 text-jajco-50">
					Expiration
				</div>
				<select
					className={cn(
						"input appearance-none !pl-4  z-10 flex-1 !rounded-l-xl cursor-pointer ",
						className
					)}
					value={value}
					onChange={handleSelectChange}>
					<option value="custom">Custom</option>
					<option value="7d">7 days</option>
					<option value="1d">1 day</option>
					<option value="12m">12 hours</option>
					<option value="6h">6 hours</option>
					<option value="1h">1 hour</option>
					<option value="45m">45 minutes</option>
					<option value="30m">30 minutes</option>
					<option value="20m">20 minutes</option>
					<option value="15m">15 minutes</option>
					<option value="10m">10 minutes</option>
					<option value="never">Never</option>
				</select>

				<div className="absolute top-4 right-0 flex items-center pr-3 pointer-events-none">
					<svg
						className="w-5 h-5 text-gray-500 -translate-x-3 z-20"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 20 20"
						fill="currentColor"
						aria-hidden="true">
						<path
							fillRule="evenodd"
							d="M6.293 9.293a1 1 0 011.414 0L10 11.586l2.293-2.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
							clipRule="evenodd"
						/>
					</svg>
				</div>
			</div>
			{value === "custom" && (
				<input
					className="input mt-2.5 pr-6 w-full"
					type="datetime-local"
					value={customValue}
					// TODO: Restrict to current date+
					onInput={(event) =>
						setCustomValue!((event.target as HTMLInputElement).value)
					}
				/>
			)}
		</>
	);
};

export default SelectTimeInput;

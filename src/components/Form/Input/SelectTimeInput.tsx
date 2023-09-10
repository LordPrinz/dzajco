import React from "react";
import { cn } from "@/utils/tailwind";
import Select from "./Select";

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
	| "12h"
	| "6h"
	| "1h"
	| "45m"
	| "30m"
	| "20m"
	| "15m"
	| "10m"
	| "never"
	| Date;

const currentDateTime = new Date();
currentDateTime.setMinutes(currentDateTime.getMinutes() + 10);
const minDateTimeISO = currentDateTime.toISOString().slice(0, 16);

const options = [
	{
		name: "Custom",
		value: "custom",
	},
	{
		name: "7 days",
		value: "7d",
	},
	{
		name: "1 day",
		value: "1d",
	},
	{
		name: "12 hours",
		value: "12h",
	},
	{
		name: "6 hours",
		value: "6h",
	},
	{
		name: "1 hour",
		value: "1h",
	},
	{
		name: "45 minuts",
		value: "45min",
	},
	{
		name: "30 minuts",
		value: "30min",
	},
	{
		name: "20 minuts",
		value: "20min",
	},
	{
		name: "15 minuts",
		value: "15min",
	},
	{
		name: "10 minuts",
		value: "10min",
	},
	{
		name: "Never",
		value: "never",
	},
];

const SelectTimeInput = ({
	value,
	setValue,
	className,
	customValue,
	setCustomValue,
}: Props) => {
	const handleSelectChange = (selectedValue: string) => {
		setValue(selectedValue);
	};

	console.log(value);
	return (
		<>
			<div className="relative flex w-full">
				<div className="h-full shadow bg-jajco-500 px-6 rounded-l-full py-4 text-jajco-50">
					Expiration
				</div>
				<Select
					label="Expiration"
					onChange={handleSelectChange}
					values={options}
					value={value}
				/>
				{/* <select
					className={cn(
						"input appearance-none !pl-4  z-10 flex-1 !rounded-l-xl cursor-pointer ",
						className
					)}
					value={value}
					onChange={handleSelectChange}>
					<option value="custom">Custom</option>
					<option value="7d">7 days</option>
					<option value="1d">1 day</option>
					<option value="12h">12 hours</option>
					<option value="6h">6 hours</option>
					<option value="1h">1 hour</option>
					<option value="45m">45 minutes</option>
					<option value="30m">30 minutes</option>
					<option value="20m">20 minutes</option>
					<option value="15m">15 minutes</option>
					<option value="10m">10 minutes</option>
					<option value="never">Never</option>
				</select> */}

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
					min={minDateTimeISO}
					onInput={(event) =>
						setCustomValue!((event.target as HTMLInputElement).value)
					}
				/>
			)}
		</>
	);
};

export default SelectTimeInput;

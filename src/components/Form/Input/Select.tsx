import React from "react";
import * as RadixSelect from "@radix-ui/react-select";
import { AiOutlineCheck } from "react-icons/ai";
import { BsChevronDown, BsChevronUp } from "react-icons/bs";

type SelectOptions = {
	value?: string;
	onChange: (value: string) => void;
	label: string;
	values: {
		name: string;
		value: string;
	}[];
	open: boolean;
	setOpen: (isOpen: boolean) => void;
};

export type SelectItemOptions = {
	value: string;
	name: string;
};

const Select = ({
	label,
	onChange,
	values,
	value,
	open,
	setOpen,
}: SelectOptions) => {
	return (
		<RadixSelect.Root
			open={open}
			onOpenChange={(open) => {
				setOpen(open);
			}}
			onValueChange={(selectedValue) => {
				onChange(selectedValue);
			}}
			value={value}>
			<RadixSelect.Trigger
				aria-label={label}
				className="relative w-full rounded-r-full   px-4 py-2 text-left text-sm outline-none bg-white shadow">
				<RadixSelect.Value placeholder={label} />
			</RadixSelect.Trigger>
			<RadixSelect.Portal>
				<RadixSelect.Content className="w-full overflow-hidden rounded-md border bg-gray-50 z-50">
					<RadixSelect.ScrollDownButton className="flex h-8 cursor-default items-center justify-center py-2">
						<BsChevronUp />
					</RadixSelect.ScrollDownButton>
					<RadixSelect.Viewport>
						{values.map((val) => (
							<SelectItem key={val.value} value={val.value} name={val.name} />
						))}
					</RadixSelect.Viewport>
					<RadixSelect.ScrollDownButton className="flex h-8 cursor-default items-center justify-center py-2">
						<BsChevronDown />
					</RadixSelect.ScrollDownButton>
				</RadixSelect.Content>
			</RadixSelect.Portal>
		</RadixSelect.Root>
	);
};

const SelectItem = ({ value, name }: SelectItemOptions) => {
	return (
		<RadixSelect.Item
			value={value}
			className="relative flex h-9 select-none items-center rounded-sm pl-6 pr-8 text-sm leading-none data-[disabled]:pointer-events-none data-[highlighted]:bg-gray-100 data-[highlighted]:outline-none">
			<RadixSelect.ItemText className="translate-x-3 text-left">
				{name}
			</RadixSelect.ItemText>
			<RadixSelect.ItemIndicator className="absolute right-3 inline-flex w-4 items-center justify-center">
				<AiOutlineCheck />
			</RadixSelect.ItemIndicator>
		</RadixSelect.Item>
	);
};

export default Select;

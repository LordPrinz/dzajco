type Props = {
	value: string;
	formSubmitHandler: () => void;
	setValue: (value: string) => void;
};

const SubmitInput = ({ formSubmitHandler, value, setValue }: Props) => {
	return (
		<div className="flex">
			<input
				className="flex-1 py-4 rounded-full pl-6 outline-none z-10 pr-5 w-full"
				type="text"
				placeholder="Link"
				value={value}
				onInput={(event: React.ChangeEvent<HTMLInputElement>) => {
					setValue(event.target.value.trim());
				}}
			/>

			<input
				type="submit"
				value="Dżajcuj"
				className="bg-[#4762fb] -translate-x-7 pl-10 pr-7 rounded-tr-full transition rounded-br-full text-white cursor-pointer outline-none hover:bg-[#2042ff] hover:transition"
				onClick={formSubmitHandler}
			/>
		</div>
	);
};

export default SubmitInput;

const Select = ({ onInput, value }: any) => (
	<select
		className="select"
		onInput={onInput}
		defaultValue={"never"}
		value={value}
	>
		<option value="never" className="option">
			Link never expires
		</option>
		<option value="365d" className="option">
			Link expires in 365 days
		</option>
		<option value="60d" className="option">
			Link expires in 60 days
		</option>
		<option value="30d" className="option">
			Link expires in 30 days
		</option>
		<option value="14d" className="option">
			Link expires in 14 days
		</option>
		<option value="7d" className="option">
			Link expires in 7 days
		</option>
		<option value="3d" className="option">
			Link expires in 3 days
		</option>
		<option value="1d" className="option">
			Link expires in 1 day
		</option>
		<option value="12h" className="option">
			Link expires in 12 hour
		</option>
		<option value="6h" className="option">
			Link expires in 6 hour
		</option>
		<option value="2h" className="option">
			Link expires in 2 hour
		</option>
		<option value="1h" className="option">
			Link expires in 1 hour
		</option>
	</select>
);

export default Select;

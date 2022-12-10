type Props = {};

const Select = (props: Props) => {
	return (
		<select className="select">
			<option className="option" selected>
				Link never expires
			</option>
			<option className="option">Link expires in 365 days</option>
			<option className="option">Link expires in 60 days</option>
			<option className="option">Link expires in 30 days</option>
			<option className="option">Link expires in 14 days</option>
			<option className="option">Link expires in 7 days</option>
			<option className="option">Link expires in 3 days</option>
			<option className="option">Link expires in 1 day</option>
			<option className="option">Link expires in 12 hour</option>
			<option className="option">Link expires in 6 hour</option>
			<option className="option">Link expires in 2 hour</option>
			<option className="option">Link expires in 1 hour</option>
		</select>
	);
};

export default Select;

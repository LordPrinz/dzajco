const Form = () => {
	const formSubmitHandler = () => {};

	return (
		<form onSubmit={formSubmitHandler}>
			<input type="text" placeholder="link" />
			<input type="submit" value="Skróć" />
		</form>
	);
};

export default Form;

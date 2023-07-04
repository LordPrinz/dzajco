export const sendWrongInputResponse = (message: string) => {
	return new Response(message, {
		status: 422,
	});
};

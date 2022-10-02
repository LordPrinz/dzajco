import { createSlice } from "@reduxjs/toolkit";

const initialState = {
	notification: null,
};

export const notificationSlice = createSlice({
	name: "notification",
	initialState,
	reducers: {
		show: () => {},
		hide: () => {},
	},
});

export const { show, hide } = notificationSlice.actions;
export default notificationSlice.reducer;

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
	notification: null,
};

export const notificationSlice = createSlice({
	name: "notification",
	initialState,
	reducers: {
		show: (state, action) => {
			state.notification = action.payload;
		},
		hide: (state, action) => {
			state.notification = null;
		},
	},
});

export const { show, hide } = notificationSlice.actions;
export default notificationSlice.reducer;

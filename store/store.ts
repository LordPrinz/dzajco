import { configureStore } from "@reduxjs/toolkit";
import notificationSlice from "./slices/notificationSlice";

export const store = configureStore({
	reducer: {
		notification: notificationSlice,
	},
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

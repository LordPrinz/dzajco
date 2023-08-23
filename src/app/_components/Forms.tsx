import MainForm from "@/components/Form/MainForm";
import React from "react";
import { mainFormAction } from "../_actions/formActions";

const Forms = () => {
	return (
		<>
			<MainForm action={mainFormAction} />
		</>
	);
};

export default Forms;

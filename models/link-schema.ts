import mongoose, { Schema } from "mongoose";
const LinkSchema = new Schema({
	full: { type: String, required: true },
	short: { type: String, required: true },
	name: { type: String, required: false },
	clicks: { type: Number, required: true },
});

const name = "LinkSchema";

export default mongoose.models[name] || mongoose.model(name, LinkSchema, name);

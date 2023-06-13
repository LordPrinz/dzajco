import mongoose, { Schema } from "mongoose";
const LinkSchema = new Schema({
	_id: { type: String, required: true },
	full: { type: String, required: true },
	clicks: { type: Number, required: true },
});

// fix

const name = "LinkSchema";

export default mongoose.models[name] || mongoose.model(name, LinkSchema, name);

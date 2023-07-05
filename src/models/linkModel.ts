import mongoose, { Schema } from "mongoose";

const LinkSchema = new Schema(
	{
		_id: { type: String, required: true },
		full: { type: String, required: true },
		clicks: { type: Number, required: true },
		expire: { type: String, default: "never" },
	},
	{
		versionKey: false,
	}
);

LinkSchema.set("toJSON", {
	transform: function (doc, ret) {
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	},
});

LinkSchema.set("toObject", { virtuals: true });

LinkSchema.methods.incrementClicks = async function () {
	this.clicks++;
	await this.save();
};

const Link = mongoose.model("link", LinkSchema);

export default Link;

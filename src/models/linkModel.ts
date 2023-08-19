import mongoose, { Schema, Document } from "mongoose";

interface ILink extends Document {
	_id: string;
	full: string;
	visits: number;
	expire: string;
	incrementVisits: () => Promise<void>;
}

const LinkSchema = new Schema(
	{
		_id: { type: String, required: true },
		full: { type: String, required: true },
		visits: { type: Number, required: true },
		expire: { type: String, default: "never" },
	},
	{
		versionKey: false,
	}
);

LinkSchema.index({ expire: 1 }, { expireAfterSeconds: 0 });

LinkSchema.set("toJSON", {
	transform: function (doc, ret) {
		ret.id = ret._id;
		delete ret._id;
		delete ret.__v;
	},
});

LinkSchema.set("toObject", { virtuals: true });

LinkSchema.methods.incrementVisits = async function (): Promise<void> {
	this.visits++;
	await this.save();
};

let Link: mongoose.Model<ILink>;
try {
	Link = mongoose.model<ILink>("link");
} catch {
	Link = mongoose.model<ILink>("link", LinkSchema);
}

export default Link;

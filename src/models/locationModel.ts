import mongoose, { Schema } from "mongoose";

export type IVisitsLocation = {
	visits: number;
	lat: number;
	lon: number;
	_id: string;
};

const LocationSchema = new Schema(
	{
		_id: { type: String },
		visits: { type: Number },
		lat: { type: Number },
		lon: { type: Number },
	},
	{
		versionKey: false,
	}
);

LocationSchema.set("toJSON", {
	transform: function (doc, ret) {
		ret.id = ret._id;

		delete ret._id;
		delete ret._id;
		delete ret.__v;
	},
});

LocationSchema.set("toObject", { virtuals: true });

let Location: mongoose.Model<any>;
try {
	Location = mongoose.model<any>("link");
} catch {
	Location = mongoose.model<any>("link", LocationSchema);
}

export default Location;

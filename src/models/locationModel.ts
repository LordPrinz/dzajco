import mongoose, { Schema, Document } from "mongoose";

export type IVisitsLocationRaw = {
	lat: number;
	lon: number;
	_id: string;
};

interface IVisits extends Document {
	lat: number;
	lon: number;
	_id: string;
}

const LocationSchema = new Schema(
	{
		_id: { type: String, required: true },
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

let Locations: mongoose.Model<IVisits>;
try {
	Locations = mongoose.model<IVisits>("locations");
} catch {
	Locations = mongoose.model<IVisits>("locations", LocationSchema);
}

export default Locations;

import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";
import { IVisitsLocation } from "./locationModel";

interface ILink extends Document {
	_id: string;
	full: string;
	visits: number;
	expire: Date | null;
	incrementVisits: (location: Location) => Promise<void>;
	isCustom: boolean;
	visitsLocation: IVisitsLocation;
}

const LinkSchema = new Schema(
	{
		_id: { type: String, required: true },
		full: { type: String, required: true },
		visits: { type: Number, required: true },
		expire: { type: Date, default: null },
		isCustom: { type: Boolean, required: true },
		visitsLocation: [
			{
				visits: { type: Number },
				_id: { type: String },
				lat: { type: Number },
				lon: { type: Number },
			},
		],
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
		delete ret._id;
		delete ret.__v;
	},
});

LinkSchema.set("toObject", { virtuals: true });

LinkSchema.methods.incrementVisits = async function (
	location: Location
): Promise<void> {
	const locationPattern = `${location.city}_${location.state}_${location.country}`;

	console.log(location);

	const index = this.visitsLocation.findIndex(
		(visitLocation: IVisitsLocation) => visitLocation._id === locationPattern
	);

	if (index !== -1) {
		this.visitsLocation[index].visits++;
	} else {
		this.visitsLocation.push({
			visits: 1,
			lat: location.location.latitude,
			lon: location.location.longitude,
			_id: locationPattern,
		});
	}

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

import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";
import LocationsModel from "./locationModel";

export type IVisitsLocation = {
	visits: number;
	lat: number;
	lon: number;
	_id: string;
};

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
				location: {
					type: Schema.Types.ObjectId,
					ref: "Location",
				},
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

LinkSchema.pre(/^find/, async function (next) {
	await (this as any).populate("visitsLocation.location").execPopulate();

	next();
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
		const loc = new LocationsModel({
			lat: location.location.latitude,
			lon: location.location.longitude,
			_id: locationPattern,
		});

		await loc.save();

		this.visitsLocation.push({
			visits: 1,
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

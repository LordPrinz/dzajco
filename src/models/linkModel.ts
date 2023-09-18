import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";
import LocationsModel from "./locationModel";

export type IVisitsLocation = {
	visits: number;
	lat: number;
	lon: number;
	_id: string;
	location: string;
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
					type: String,
					ref: "Location",
				},
			},
		],
	},
	{
		versionKey: false,
		_id: false,
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

// LinkSchema.pre(/^find/, async function (next) {
// 	try {
// 	} catch (err) {
// 		(this as any).populate("visitsLocation.location");
// 	}

// 	next();
// });

LinkSchema.set("toObject", { virtuals: true });

LinkSchema.methods.incrementVisits = async function (
	location: Location
): Promise<void> {
	const locationPattern = `${location.city}_${location.state}_${location.country}`;

	console.log(location);

	const index = this.visitsLocation.findIndex(
		(visitLocation: IVisitsLocation) => visitLocation.location === locationPattern
	);

	if (index !== -1) {
		this.visitsLocation[index].visits++;
	} else {
		const isLocationSaved = await LocationsModel.findById(locationPattern);
		if (!isLocationSaved) {
			const loc = new LocationsModel({
				lat: location.location.latitude,
				lon: location.location.longitude,
				_id: locationPattern,
			});
			await loc.save();
		}
		try {
			this.visitsLocation?.push({
				visits: 1,
				location: locationPattern,
			});
		} catch (err) {}
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

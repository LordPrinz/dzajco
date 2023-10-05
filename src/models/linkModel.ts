import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";
import LocationsModel, { IVisitsLocationRaw } from "./locationModel";

export type IVisitsLocation = {
	visits: number;
	location: {
		lat: number;
		lon: number;
		location: string;
	};
};

interface ILink extends Document {
	_id: string;
	full: string;
	visits: number;
	expire: Date | null;
	secretKey: string | null;
	incrementVisits: (location: Location) => Promise<void>;
	visitsLocation: IVisitsLocation[];
}

const LinkSchema = new Schema(
	{
		_id: { type: String, required: true },
		full: { type: String, required: true },
		visits: { type: Number, required: true },
		expire: { type: Date, default: null },
		secretKey: { type: String },
		visitsLocation: [
			{
				visits: { type: Number },
				location: {
					type: String,
					ref: "locations",
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

LinkSchema.pre(/^find/, function (next) {
	(this as any).populate({
		path: "visitsLocation.location",
	});
	next();
});

LinkSchema.set("toJSON", {
	virtuals: true,
	transform: function (doc, ret) {
		ret.id = ret._id;
		ret.visitsLocation = ret.visitsLocation.map(
			(locationObj: { visits: number; location: IVisitsLocationRaw }) => ({
				visits: locationObj.visits,
				location: locationObj.location._id,
				lat: locationObj.location.lat,
				lon: locationObj.location.lon,
			})
		);
		delete ret._id;
		delete ret.__v;
	},
});

LinkSchema.set("toObject", {
	virtuals: true,
	transform: function (doc, ret) {
		ret.id = ret._id;

		delete ret._id;
		delete ret.__v;

		if (!ret.visitsLocation) {
			return;
		}
		ret.visitsLocation = ret.visitsLocation.map(
			(locationObj: { visits: number; location: IVisitsLocationRaw }) => ({
				visits: locationObj.visits,
				location: locationObj.location._id,
				lat: locationObj.location.lat,
				lon: locationObj.location.lon,
			})
		);
	},
});

LinkSchema.methods.incrementVisits = async function (
	location: Location
): Promise<void> {
	const locationPattern = `${location.city}_${location.state}_${location.country}`;

	const index = this.visitsLocation.findIndex(
		(visitLocation: { visits: number; location: IVisitsLocationRaw }) =>
			visitLocation.location._id === locationPattern
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

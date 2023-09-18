import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";
import LocationsModel, { IVisitsLocationRaw } from "./locationModel";

export type IVisitsLocation = {
	visits: number;
	lat: number;
	lon: number;
	location: string;
};

interface ILink extends Document {
	_id: string;
	visits: number;
	links: number;
	incrementVisits: (location: Location) => Promise<void>;
	incrementLinks: () => Promise<void>;
	visitsLocation: IVisitsLocation[];
}

const StatisticsSchema = new Schema(
	{
		_id: { type: String, required: true },
		visits: { type: Number, required: true },
		links: { type: Number, required: true },
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

StatisticsSchema.pre(/^find/, function (next) {
	(this as any).populate({
		path: "visitsLocation.location",
	});
	next();
});

StatisticsSchema.set("toJSON", {
	transform: function (doc, ret) {
		ret.id = ret._id;

		delete ret._id;
		delete ret._id;
		delete ret.__v;
	},
});

StatisticsSchema.set("toObject", {
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

StatisticsSchema.methods.incrementVisits = async function (
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

StatisticsSchema.methods.incrementLinks = async function () {
	this.links++;
	await this.save();
};

let Statistics: mongoose.Model<ILink>;
try {
	Statistics = mongoose.model<ILink>("statistics");
} catch {
	Statistics = mongoose.model<ILink>("statistics", StatisticsSchema);
}

export default Statistics;

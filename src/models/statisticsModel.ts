import { Location } from "@/utils/utils";
import mongoose, { Schema, Document } from "mongoose";

export type IVisitsLocation = {
	visits: number;
	lat: number;
	lon: number;
	_id: string;
};

interface ILink extends Document {
	_id: string;
	visits: number;
	links: number;
	incrementVisits: (location: Location) => Promise<void>;
	incrementLinks: () => Promise<void>;
	visitsLocation: IVisitsLocation;
}

const StatisticsSchema = new Schema(
	{
		_id: { type: String, required: true },
		visits: { type: Number, required: true },
		links: { type: Number, required: true },
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

StatisticsSchema.set("toJSON", {
	transform: function (doc, ret) {
		ret.id = ret._id;

		delete ret._id;
		delete ret._id;
		delete ret.__v;
	},
});

StatisticsSchema.set("toObject", { virtuals: true });

StatisticsSchema.methods.incrementVisits = async function (
	location: Location
): Promise<void> {
	const locationPattern = `${location.city}_${location.state}_${location.country}`;

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

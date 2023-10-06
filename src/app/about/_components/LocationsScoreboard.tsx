import LocationItem from "./LocationItem";
import { IVisitsLocation } from "@/models/linkModel";

type Props = {
	locations: IVisitsLocation[];
};

const LocationsScoreboard = async ({ locations }: Props) => {
	type TransformedLocation = IVisitsLocation & {
		location: {
			_id: string;
		};
	};

	const topLocations = locations
		.slice()
		.sort((a, b) => b.visits - a.visits)
		.slice(0, 8);

	const topVisitors = topLocations.map((visitor: any) => {
		const location = (visitor as TransformedLocation).location._id.split("_");

		return {
			visits: visitor.visits,
			location: `${location[0]}, ${location[2]}`,
		};
	});

	return (
		<div className="my-10 mt-14 grid gap-y-2 grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-1 px-10 ">
			{topVisitors.map((location) => (
				<LocationItem
					key={location.location}
					location={location.location}
					visits={location.visits}
				/>
			))}
		</div>
	);
};

export default LocationsScoreboard;

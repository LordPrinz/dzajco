import StatisticModel, { IVisitsLocation } from "@/models/statisticsModel";

type Props = {
	locations: IVisitsLocation[];
};

const LocationsScoreboard = async () => {
	const res = await StatisticModel.aggregate([
		{ $match: { _id: "dzajcostats" } }, // Match the document by _id
		{
			$project: {
				visitsLocation: 1, // Include the visitsLocation array
			},
		},
		{
			$unwind: "$visitsLocation", // Unwind the visitsLocation array
		},
		{
			$sort: {
				"visitsLocation.visits": -1, // Sort in descending order by visits
			},
		},
		{
			$limit: 5, // Limit the results to the top 5
		},
	]).exec();

	const topVisitors = res.map((visitor) => {
		const visitsLocation = visitor.visitsLocation;

		const location = visitsLocation.location.split("_");

		return {
			visits: visitsLocation.visits,
			location: `${location[0]}, ${location[2]}`,
		};
	});
	return (
		<div className="my-10">
			{topVisitors.map((location) => (
				<div key={location.location} className="flex flex-col items-center">
					<div>{location.location}</div>
					<div>{location.visits}</div>
				</div>
			))}
		</div>
	);
};

export default LocationsScoreboard;

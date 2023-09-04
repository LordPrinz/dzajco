import LinkModel from "@/models/linkModel";
import ChartItem from "./ChartItem";

type Props = {
	linkId: string;
};

const Chart = async ({ linkId }: Props) => {
	const res = await LinkModel.aggregate([
		{ $match: { _id: linkId } }, // Match the document by _id
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

		const location = visitsLocation._id.split("_");

		return {
			visits: visitsLocation.visits,
			location: `${location[0]}, ${location[2]}`,
		};
	});

	return (
		<div className="mt-14 space-y-4 ">
			{topVisitors.map((visitor) => (
				<ChartItem
					key={visitor.location}
					visits={visitor.visits}
					location={visitor.location}
				/>
			))}
		</div>
	);
};

export default Chart;

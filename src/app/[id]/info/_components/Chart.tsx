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

	console.log(res);

	const topVisitors = res.map((visitor) => {
		const visitsLocation = visitor.visitsLocation;

		const location = visitsLocation._id.split("_");

		return {
			visits: visitsLocation.vists,
			location: `${location[0]}, ${location[2]}`,
		};
	});

	return (
		<div className="mt-10">
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

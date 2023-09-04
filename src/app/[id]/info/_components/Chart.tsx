import LinkModel from "@/models/linkModel";

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

	return <div></div>;
};

export default Chart;

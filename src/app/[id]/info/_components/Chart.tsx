import { IVisitsLocation } from "@/models/linkModel";
import ChartItem from "./ChartItem";

type Props = {
	locations: IVisitsLocation[];
};

type TransformedLocation = IVisitsLocation & {
	location: {
		_id: string;
	};
};

const Chart = async ({ locations }: Props) => {
	const topLocations = locations
		.slice()
		.sort((a, b) => b.visits - a.visits)
		.slice(0, 5);

	const topVisitors = topLocations.map((visitor: any) => {
		const location = (visitor as TransformedLocation).location._id.split("_");

		return {
			visits: visitor.visits,
			location: `${location[0]}, ${location[2]}`,
		};
	});

	return (
		<div className="mt-14 space-y-4">
			{topVisitors?.length === 0 ? <p className="text-2xl font-bold">No Visitors</p> : null}
			{topVisitors?.map((visitor) => (
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

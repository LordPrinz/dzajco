import { IVisitsLocation } from "@/models/linkModel";

type Props = {
	visitsLocations: IVisitsLocation[];
};

const Map = ({ visitsLocations }: Props) => {
	visitsLocations.forEach((location) => {
		console.log(location._id);
	});

	return <div></div>;
};

export default Map;

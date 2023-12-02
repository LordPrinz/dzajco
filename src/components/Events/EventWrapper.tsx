import Fireworks from "@fireworks-js/react";
import ConffetiContainer from "./ConffetiContainer";
import Snowfall from "./Snowfall";

const EventWrapper = () => {
	let event = null;

	// event = <ConffetiContainer />;

	event = <Snowfall />;

	event = <Fireworks className="absolute w-full h-full" />;

	return <> {event} </>;
};

export default EventWrapper;

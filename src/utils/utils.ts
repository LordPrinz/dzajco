import { nanoid } from "nanoid";
import axios from "axios";

export const generateRandom = (min: number, max: number): number => {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min + 1)) + min;
};

export const generateLink = () => {
	return nanoid(generateRandom(3, 10));
};

export type Location = {
	city: string;
	country: string;
	location: {
		latitude: string;
		longitude: string;
	};
	state: string;
};

export const getUserLocation = async (ip: string) => {
	const data = await axios.get(
		`https://api.geoapify.com/v1/ipinfo?&apiKey=${process.env
			.GEOAPIFY_KEY!}&ip=${ip}`
	);

	const { city, country, location, state } = data.data;

	return {
		city: city.name,
		country: country.name,
		location,
		state: state.name,
	} as Location;
};

export const getLocationBoundaries = async ({
	latitude,
	longitude,
}: {
	latitude: number;
	longitude: number;
}) => {
	const data = await axios.get(
		`https://api.geoapify.com/v1/boundaries/part-of?lon=${longitude}&lat=${latitude}&geometry=geometry_1000&apiKey=${process
			.env.GEOAPIFY_KEY!}`
	);

	return data.data.features[0].geometry.coordinates;
};

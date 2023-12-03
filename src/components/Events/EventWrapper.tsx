"use client";

import Fireworks from "@fireworks-js/react";
import ConffetiContainer from "./ConffetiContainer";
import Snowfall from "./Snowfall";
import { useEffect, useState } from "react";

const EventWrapper = () => {
	const [event, setEvent] = useState<React.ReactNode | null>(null);

	useEffect(() => {
		const currentDate = new Date();
		const currentMonth = currentDate.getMonth() + 1;
		const currentDay = currentDate.getDate();

		const isBetween = (
			day: number,
			month: number,
			startDay: number,
			startMonth: number,
			endDay: number,
			endMonth: number
		): boolean => {
			return (
				(month === startMonth &&
					day >= startDay &&
					month === endMonth &&
					day <= endDay) ||
				(month === startMonth && day >= startDay && month < endMonth) ||
				(month > startMonth && month === endMonth && day <= endDay) ||
				(month > startMonth && month < endMonth)
			);
		};

		if (isBetween(currentDay, currentMonth, 3, 12, 28, 12)) {
			setEvent(<Snowfall />);
		} else if (
			(currentMonth === 12 &&
				isBetween(currentDay, currentMonth, 28, 12, 31, 12)) ||
			(currentMonth === 1 && isBetween(currentDay, currentMonth, 1, 1, 6, 1))
		) {
			setEvent(<Fireworks className="absolute w-full h-full" />);
		} else if (currentMonth === 2 && currentDay === 29) {
			setEvent(<ConffetiContainer isText={false} />);
		} else if (isBetween(currentDay, currentMonth, 26, 10, 28, 10)) {
			setEvent(<ConffetiContainer isText />);
		}
	}, []);

	return <>{event}</>;
};

export default EventWrapper;

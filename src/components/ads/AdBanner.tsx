"use client";

import { cn } from "@/utils/tailwind";
import { ReactNode, useEffect } from "react";

type AdBannerProps = {
	slot: string;
	format?: string;
	layout?: string;
	children?: ReactNode;
	className?: string;
};

const AdBanner = (props: AdBannerProps) => {
	useEffect(() => {
		try {
			((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
		} catch (err) {
			console.log(err);
		}
	}, []);

	const { slot, format, layout, className } = props;

	return (
		<ins
			className={cn("adsbygoogle adbanner-customize", className)}
			style={{
				display: "block",
				overflow: "hidden",
			}}
			data-ad-client={process.env.NEXT_PUBLIC_GOOGLE_ADS_CLIENT_ID}
			data-ad-slot={slot}
			data-ad-format={format}
			data-ad-layout={layout}
			{...props}
		/>
	);
};
export default AdBanner;

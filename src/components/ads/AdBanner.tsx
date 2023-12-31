"use client";

import { ReactNode, useEffect } from "react";

type AdBannerProps = {
	slot: string;
	format?: string;
	layout?: string;
	children?: ReactNode;
};

const AdBanner = (props: AdBannerProps) => {
	useEffect(() => {
		try {
			((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
		} catch (err) {
			console.log(err);
		}
	}, []);

	const { slot, format, layout } = props;

	return (
		<ins
			className="adsbygoogle adbanner-customize"
			style={{
				display: "block",
				overflow: "hidden",
			}}
			data-ad-client={process.env.GOOGLE_ADS_CLIENT_ID}
			data-ad-slot={slot}
			data-ad-format={format}
			data-ad-layout={layout}
			{...props}
		/>
	);
};
export default AdBanner;

import React from "react";
import { Props } from "./page";
import { ImageResponse } from "next/server";
import dbConnect, { findNotDetailedLink } from "@/utils/db";

export const size = {
	width: 900,
	height: 530,
};

export const contentType = "image/jpg";

export default async function og({ params }: Props) {
	const { id } = params;

	await dbConnect();

	const link = await findNotDetailedLink(params.id);

	if (!link) {
		return new ImageResponse(
			(
				<div tw="relative flex w-full flex-col h-full items-center justify-center bg-[#f2f2f2]">
					<div tw="flex w-3/8">
						<img src="https://www.dzaj.de/404.svg" alt="404 image" />
					</div>
					<div tw="flex mt-8">
						<h1 tw="flex text-5xl">
							No i co? <div tw="text-[#ffcc00] ml-5">Dżajco</div>
						</h1>
					</div>
				</div>
			)
		);
	}

	const isCustom = !!link.secretKey;

	const text = isCustom ? "Custom generated" : "Auto generated";

	return new ImageResponse(
		(
			<div tw="relative w-full h-full flex bg-[#f2f2f2]">
				<div tw="absolute w-full h-6 flex bg-[#f79a2c] bottom-0"></div>
				<div tw="flex p-16 flex-col w-full">
					<div tw="flex w-full ">
						<div tw="flex flex-col flex-1">
							<div tw="flex text-6xl mt-9 text-gray-800">
								Dzajco/
								<strong tw="font-bold">{id}</strong>
							</div>
							<div
								tw="text-gray-600 mt-3 text-2xl "
								style={{
									fontWeight: "bold",
								}}>
								{text}
							</div>
							<div tw="flex text-xs absolute top-[88%] text-gray-500">{link.full}</div>
						</div>
						<div tw="flex right-10 ">
							<img
								src="https://dzaj.de/logo.png"
								width={200}
								height={200}
								alt="logo"
							/>
						</div>
					</div>
					<div tw="flex items-center h-full text-gray-600">
						<div tw="flex mt-10">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								fill="none"
								viewBox="0 0 24 24"
								stroke-width="1.5"
								stroke="currentColor"
								style={{
									width: "40px",
									height: "40px",
								}}>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59"
								/>
							</svg>
							<div tw="flex flex-col justify-center ml-3 mt-1.5">
								<div tw="gray-800 flex text-lg">{link.visits}</div>
								<span>{link.visits === 1 ? "Visit" : "Visits"}</span>
							</div>
						</div>
					</div>
				</div>
			</div>
		)
	);
}

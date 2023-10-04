import React from "react";
import { Props } from "./page";
import { ImageResponse } from "next/server";
import dbConnect, { findLink } from "@/utils/db";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function og({ params }: Props) {
  const { id } = params;

  //   await dbConnect();

  //   const link = await findLink({ id: params.id });

  //   if (!link) {
  //     return new ImageResponse(
  //       <div tw="relative flex w-full h-full">Not found!</div>
  //     );
  //   }

  return new ImageResponse(
    (
      <div tw="relative w-full h-full flex">
        Dzajco/<span>{id}</span>
      </div>
    )
  );
}

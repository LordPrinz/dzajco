"use client";

import Button from "@/components/shared/Button";
import Image from "next/image";
import { useRouter } from "next/navigation";

const Error = ({ error, reset }: { error: Error; reset: () => void }) => {
	const { push } = useRouter();

	return (
		<main className="flex h-full w-full items-center justify-center col-[center-start/center-end]">
			<div>
				<div className="aspect-square relative scale-125  mb-8 max-w-md mx-auto">
					<Image src="/cracked_egg.svg" alt="Cracked egg image" fill={true} />
				</div>

				<h3 className="text-4xl font-extrabold  tracking-widest text-[#1C1C1C] text-center">
					<p>{error.message || "Something went wrong."}</p>
				</h3>
				<div className="mt-8 flex justify-center gap-3">
					<Button onClick={reset} style="fill">
						Retry
					</Button>
					<Button
						style="outlined"
						onClick={() => {
							push("/");
						}}>
						Home
					</Button>
				</div>
			</div>
		</main>
	);
};

export default Error;

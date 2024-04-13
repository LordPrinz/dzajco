"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type Props = {
	redirectUrl: string;
};

const RedirectPage = ({ redirectUrl }: Props) => {
	const router = useRouter();

	useEffect(() => {
		router.replace(redirectUrl);
	}, []);

	return (
		<div className="col-[center-start/center-end]">
			<div className="text-center text-4xl text-jajco-500 mt-14 animate-pulse">
				Redirecting...
			</div>
		</div>
	);
};

export default RedirectPage;

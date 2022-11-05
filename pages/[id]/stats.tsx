import type { NextPage } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";
import Circle from "../../components/Circle";
import Head from "next/head";
import { AiOutlineArrowLeft } from "react-icons/ai";
import { useRouter } from "next/router";

const StatsPage: NextPage = (props: any) => {
	const router = useRouter();
	return (
		<>
			<Head>
				<title>Dzajco | Link click counter</title>
			</Head>
			<div className="relative">
				<AiOutlineArrowLeft
					className="absolute text-3xl left-5 top-5 cursor-pointer hover:text-[#313131] transition hover:transition"
					onClick={() => {
						router.back();
					}}
				/>
				<div className="flex justify-center items-center h-[100vh] flex-col">
					<Circle number={props.clicks} />
				</div>
			</div>
		</>
	);
};

export default StatsPage;

export async function getServerSideProps({ req }: { req: any }) {
	const url = req.url.slice(1).split("/")[0];

	await dbConnect();

	const link = await linkSchema.findById(url);

	if (!link) {
		return {
			notFound: true,
		};
	}

	return {
		props: {
			clicks: link.clicks,
			page: url,
		},
	};
}

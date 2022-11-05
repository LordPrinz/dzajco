import type { NextPage } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";
import { SiEgghead } from "react-icons/si";
import Circle from "../../components/Circle";
const StatsPage: NextPage = (props: any) => {
	return (
		<>
			<div className="flex justify-center items-center h-[100vh] flex-col">
				{/* <div className="relative">
          <h1 className="text-6xl p-32 border-8 rounded-full">
            {props.clicks || 0}
          </h1>
          <span className="absolute top-0 left-1/2 -translate-x-1/2 z-10 bg-[#eee] px-4 -translate-y-4 text-4xl text-[#909296]">
            <SiEgghead />
          </span>
        </div> */}
				<Circle number={props.clicks} />
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

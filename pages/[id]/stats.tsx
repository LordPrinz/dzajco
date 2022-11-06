import type { NextPage, GetServerSideProps } from "next";
import dbConnect from "../../lib/dbConnect";
import linkSchema from "../../models/link-schema";
import Circle from "../../components/Circle";
import Head from "next/head";
import { AiOutlineArrowLeft } from "react-icons/ai";
import { useRouter } from "next/router";

type Props = {
	clicks: number;
};

const StatsPage: NextPage<Props> = (props) => {
	const router = useRouter();

	const backButtonHandler = () => {
		router.back();
	};

	return (
		<>
			<Head>
				<title>Dzajco | Link click counter</title>
			</Head>
			<div className="relative">
				<AiOutlineArrowLeft
					className="stats__backButton"
					onClick={backButtonHandler}
				/>
				<div className="stats__circleContainer">
					<Circle number={props.clicks} />
				</div>
			</div>
		</>
	);
};

export default StatsPage;

export const getServerSideProps: GetServerSideProps = async ({ req }) => {
	const url = req.url?.slice(1).split("/")[0];

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
};

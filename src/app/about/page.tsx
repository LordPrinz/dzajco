import HomeButton from "@/components/shared/HomeButton";
import Counter from "../[id]/info/_components/Counter";
import dbConnect from "@/utils/db";

const AboutPage = async () => {
	await dbConnect();

	return (
		<div className="col-[center-start/center-end]  mt-10">
			<HomeButton />
			<section className="grid gap-2 sm:grid-cols-2 grid-rows-2 mt-12">
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Shorten Links</h3>
					<Counter visits={19} className="flex-1 flex my-12 justify-center mt-9" />
				</div>
				<div className="info-panel py-4">
					<h3 className="font-bold text-3xl text-center mt-12">Total uses</h3>
					<Counter visits={19} className="flex-1 flex my-12 mt-9 justify-center" />
				</div>
			</section>
		</div>
	);
};

export default AboutPage;

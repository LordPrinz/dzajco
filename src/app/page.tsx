import Header from "@/components/Layout/Header";
import Forms from "./_components/Forms";
import EventWrapper from "@/components/Events/EventWrapper";
import About from "./about/_components/About";
import AdBanner from "@/components/ads/AdBanner";

export default function Home() {
	return (
		<>
			<EventWrapper />
			<main className="col-[center-start/center-end] z-10 mb-16">
				<Header />
				<Forms />
				{/* <AdBanner
					slot="3847126497"
					format="auto"
					data-full-width-responsive
					className="mb-16"
				/> */}

				{/* <AdBanner slot="8933882351" format="auto" data-full-width-responsive /> */}
			</main>
		</>
	);
}

import Header from "@/components/Layout/Header";
import Forms from "./_components/Forms";
import EventWrapper from "@/components/Events/EventWrapper";
import About from "./_components/About";
import AdBanner from "@/components/ads/AdBanner";

export default function Home() {
	return (
		<>
			<EventWrapper />
			<main className="col-[center-start/center-end] z-10">
				<Header />
				<Forms />
				<AdBanner
					slot="3847126497"
					format="auto"
					data-full-width-responsive
					className="mb-16"
				/>
				<About />
			</main>
		</>
	);
}

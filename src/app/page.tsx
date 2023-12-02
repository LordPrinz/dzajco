import Header from "@/components/Layout/Header";
import Forms from "./_components/Forms";
import EventWrapper from "@/components/Events/EventWrapper";
// import ConffetiContainer from "@/components/Events/ConffetiContainer";

export default function Home() {
	return (
		<>
			<EventWrapper />
			<main className="col-[center-start/center-end] z-10">
				<Header />
				<Forms />
			</main>
		</>
	);
}

import Header from "@/components/Layout/Header";
import Forms from "./_components/Forms";
import EventWrapper from "@/components/Events/EventWrapper";
// import ConffetiContainer from "@/components/Events/ConffetiContainer";

export default function Home() {
	return (
		<>
			<EventWrapper />
			<main className="col-[center-start/center-end]">
				<Header />
				<Forms />
			</main>
		</>
	);
}

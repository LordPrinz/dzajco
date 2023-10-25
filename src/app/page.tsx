import Header from "@/components/Layout/Header";
import Forms from "./_components/Forms";
import ConffetiContainer from "@/components/Events/ConffetiContainer";

export default function Home() {
	return (
		<>
			<ConffetiContainer />
			<main className="col-[center-start/center-end]">
				<Header />
				<Forms />
			</main>
		</>
	);
}

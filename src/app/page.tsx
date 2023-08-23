import MainForm from "@/components/Form/MainForm";
import Header from "@/components/Header/Header";
import { mainFormAction } from "./_actions/formActions";

export default function Home() {
	return (
		<main className="col-[center-start/center-end]">
			<Header />
			<MainForm action={mainFormAction} />
		</main>
	);
}

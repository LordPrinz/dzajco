import HomeButton from "@/components/shared/HomeButton";
import ApiElement from "./_components/ApiElement";

const Page = () => {
	return (
		<main className="col-[center-start/center-end] text-jajco-500 text-4xl text-center mt-16">
			<HomeButton />
			<section>
				<ApiElement
					endpoint="/api/urls/{shortUrl}"
					method="GET"
					name="Get Redirect URL">
					XD
				</ApiElement>
			</section>
		</main>
	);
};

export default Page;

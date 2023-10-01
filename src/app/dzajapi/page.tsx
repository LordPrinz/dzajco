import HomeButton from "@/components/shared/HomeButton";
import ApiElement from "./_components/ApiElement";
import ApiResponseSuccess from "./_components/ApiResponseSuccess";

const Page = () => {
	return (
		<main className="col-[center-start/center-end] text-jajco-500 text-4xl text-center mt-16">
			<HomeButton />
			<h1>Dzajco API v2.0.0</h1>
			<section className="mt-20">
				<ApiElement
					endpoint="/api/urls/{shortUrl}"
					method="GET"
					name="Get Redirect URL">
					<ApiResponseSuccess
						status={200}
						data={[
							{
								filed: "fullLink",
								type: "string",
							},
						]}
					/>
				</ApiElement>
			</section>
		</main>
	);
};

export default Page;

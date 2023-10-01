import HomeButton from "@/components/shared/HomeButton";
import ApiElement from "./_components/ApiElement";
import ApiResponseSuccess from "./_components/ApiResponseSuccess";
import ApiResponseError from "./_components/ApiResponseError";

const Page = () => {
	return (
		<main className="col-[center-start/center-end] text-jajco-500 text-center mt-10">
			<HomeButton />
			<h1 className="text-3xl ">Dzajco API v2.0.0</h1>
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
					<ApiResponseError
						status={404}
						data={[{ filed: "error", type: "string" }]}
					/>
					<ApiResponseError
						status={429}
						data={[{ filed: "error", type: "string" }]}
					/>
				</ApiElement>
			</section>
		</main>
	);
};

export default Page;

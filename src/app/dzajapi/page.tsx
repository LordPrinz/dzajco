import HomeButton from "@/components/shared/HomeButton";
import ApiElement from "./_components/ApiElement";
import ApiResponseSuccess from "./_components/ApiResponseSuccess";
import ApiResponseError from "./_components/ApiResponseError";
import ApiQuery from "./_components/ApiQuery";
import { Metadata } from "next";

export const metadata: Metadata = {
	title: "Dzaj API",
	description: "An API documentation",
	alternates: {
		canonical: `/dzajapi`,
		languages: {
			"en-US": `/dzajapi`,
		},
	},
};

const Page = () => {
	return (
		<main className="col-[center-start/center-end] text-jajco-500 text-center mt-10">
			<HomeButton />
			<h1 className="text-3xl ">Dzajco API v2.0.0</h1>
			<section className="mt-20 space-y-6">
				<ApiElement
					endpoint="/api/urls/{shortUrl}"
					method="GET"
					name="Get Redirect URL">
					<p className="text-gray-600 mt-2 text-left">Response</p>
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
				<ApiElement
					endpoint="/api/urls/{shortUrl}/info"
					method="GET"
					name="Get URL info">
					<p className="text-gray-600 mt-2 text-left">Response</p>
					<ApiResponseSuccess
						status={200}
						data={[
							{
								filed: "id",
								type: "string",
							},
							{
								filed: "fullLink",
								type: "string",
							},
							{
								filed: "visits",
								type: "number",
							},
							{
								filed: "expire",
								type: "null | Date",
							},
							{
								filed: "visitsLocation",
								type:
									'{\n    "visits": number\n    "location": string\n    "lat": number\n    "lon": number\n  }',
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
				<ApiElement endpoint="/api/urls" method="POST" name="Create Shorten URL">
					<p className="text-gray-600 mt-2 text-left">Body</p>
					<ApiQuery
						data={[
							{
								filed: "url",
								type: "string",
							},
							{
								filed: "customName",
								type: "string",
							},
							{
								filed: "expire",
								type: "Date | null",
							},
						]}
					/>
					<p className="text-gray-600 mt-2 text-left">Response</p>
					<ApiResponseSuccess
						status={201}
						data={[
							{
								filed: "message",
								type: "string",
							},
							{
								filed: "shortUrl",
								type: "string",
							},
							{
								filed: "secretKey",
								type: "string | null",
							},
						]}
					/>
					<ApiResponseError
						status={422}
						data={[{ filed: "error", type: "string" }]}
					/>
					<ApiResponseError
						status={429}
						data={[{ filed: "error", type: "string" }]}
					/>
				</ApiElement>
				<ApiElement
					endpoint="/api/urls/{shortUrl}"
					method="DELETE"
					name="Delete Shorten URL">
					<p className="text-gray-600 mt-2 text-left">Body</p>
					<ApiQuery
						data={[
							{
								filed: "secretKey",
								type: "string",
							},
						]}
					/>
					<p className="text-gray-600 mt-2 text-left">Response</p>
					<ApiResponseSuccess
						status={200}
						data={[
							{
								filed: "message",
								type: "string",
							},
						]}
					/>
					<ApiResponseError
						status={422}
						data={[{ filed: "error", type: "string" }]}
					/>
				</ApiElement>
			</section>
		</main>
	);
};

export default Page;

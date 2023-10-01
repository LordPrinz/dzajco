import HomeButton from "@/components/shared/HomeButton";
import React from "react";

const PrivacyPolicy = () => {
	return (
		<main className="mt-8 p-8 col-[center-start/center-end]">
			<HomeButton />
			<div className="max-w-2xl mx-auto">
				<h1 className="text-4xl font-semibold mb-4 text-jajco-500">
					Privacy Policy
				</h1>
				<p className="mb-4 text-sm">Effective Date: 07.09.2023</p>

				<h2 className="text-xl font-semibold mt-4 mb-2">
					Privacy Policy for Dzajco
				</h2>
				<p>
					Welcome to Dzajco. At Dzajco, we are committed to protecting the privacy
					and security of your personal information. This Privacy Policy outlines the
					types of personal data we collect, how we use it, and the choices you have
					regarding your information. Please read this policy carefully to understand
					how we handle your data.
				</p>

				<h2 className="text-xl font-semibold mt-4 mb-2">Information We Collect</h2>

				<h3 className="text-lg font-semibold mt-2 mb-1">
					2.1. Personal Information
				</h3>
				<p>
					We collect the following personal information when you use our link
					shortening service:
				</p>
				<ul className="list-disc ml-6">
					<li>
						<strong>Generalized Location:</strong> We may collect generalized location
						data, such as your city or country, based on your IP address. This
						information helps us understand the geographic distribution of our users.
						It does not provide specific details about your exact location.
					</li>
				</ul>

				<h3 className="text-lg font-semibold mt-4 mb-1">2.2. Usage Data</h3>
				<p>
					In addition to personal information, we collect usage data, including:
				</p>
				<ul className="list-disc ml-6">
					<li>
						<strong>IP Address:</strong> We process your IP address to detect your
						location. We don{"'t"} store your IP Address.
					</li>
				</ul>

				<h2 className="text-xl font-semibold mt-4 mb-2">Contact Us</h2>
				<p>
					If you have any questions, concerns, or requests related to this Privacy
					Policy or our data practices, please contact us at pykejett@gmail.com.
				</p>

				<p className="mt-4">
					By using our link shortening service, you agree to the terms outlined in
					this Privacy Policy.
				</p>

				<p className="mt-2">Last Updated: 07.09.2023</p>
			</div>
		</main>
	);
};

export default PrivacyPolicy;

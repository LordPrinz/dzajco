export default async function sitemap() {
	const baseUrl = "https://dzaj.de";

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
		},
		{
			url: `${baseUrl}/about`,
			lastModified: new Date(),
		},
		{
			url: `${baseUrl}/history`,
			lastModified: new Date(),
		},
		{
			url: `${baseUrl}/dzajapi`,
			lastModified: new Date(),
		},
		{
			url: `${baseUrl}/privacy-policy`,
			lastModified: new Date(),
		},
	];
}

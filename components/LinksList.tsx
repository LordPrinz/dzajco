import FooterLink from "./FooterLink";

const LinksList = () => {
	const links = [
		{
			name: "Author",
			url: "https://dzaj.de/author",
		},
		{
			name: "Github",
			url: "https://dzaj.de/github",
		},
		{
			name: "About",
			url: "https://dzaj.de/about",
		},
		{
			name: "API",
			url: "#",
		},
		{
			name: "Private Police",
			url: "#",
		},
	];

	return (
		<ul className="links__list">
			{links.map((link, index) => (
				<FooterLink key={index} name={link.name} url={link.url} />
			))}
		</ul>
	);
};

export default LinksList;

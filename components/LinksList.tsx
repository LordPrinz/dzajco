import FooterLink from "./FooterLink";

const LinksList = () => {
	const links = [
		{
			name: "Author",
			url: "https://github.com/LordPrinz",
		},
		{
			name: "Github",
			url: "https://github.com/LordPrinz/dzajco",
		},
		{
			name: "About",
			url: "https://github.com/LordPrinz/dzajco#table-of-contents",
		},
		{
			name: "API",
			url: "/api",
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

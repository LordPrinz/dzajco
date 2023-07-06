import FooterLink from "./FooterLink";

const LINKS = [
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
		url: "/dzajapi",
	},
	{
		name: "Privacy Policy",
		url: "/privacy-policy",
	},
];

const LinksList = () => {
	return (
		<ul className="links__list">
			{LINKS.map((link, index) => (
				<FooterLink key={index} name={link.name} url={link.url} />
			))}
		</ul>
	);
};

export default LinksList;

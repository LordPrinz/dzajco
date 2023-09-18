import FooterLink from "./FooterLink";

const LINKS = [
{
	name: "Home",
	url: "/"
},{
	name: "About",
	url: "/about",
},
{
	name: "History",
	url: "/history"
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

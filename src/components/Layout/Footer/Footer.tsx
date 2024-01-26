import LinksList from "./LinksList";

const Footer = () => {
	return (
		<footer className="pb-1 flex flex-1 items-center mt-3 flex-wrap justify-center col-[full-start/full-end] z-[999] fixed bottom-0 bg-light-bg-primary opacity-80 w-full pt-5">
			<LinksList />
		</footer>
	);
};

export default Footer;

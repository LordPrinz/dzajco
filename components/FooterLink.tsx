import Link from "next/link";
import { FC } from "react";

type Props = {
	name: string;
	url: string;
};

const FooterLink: FC<Props> = ({ name, url }) => {
	return (
		<Link href={url}>
			<a className="links__link">{name}</a>
		</Link>
	);
};

export default FooterLink;

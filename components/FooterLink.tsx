import Link from "next/link";
import { FC } from "react";

type Props = {
	name: string;
	url: string;
};

const FooterLink: FC<Props> = ({ name, url }) => {
	return (
		<Link href={url}>
			<li className="links__item">
				<a className="links__link">{name}</a>
			</li>
		</Link>
	);
};

export default FooterLink;

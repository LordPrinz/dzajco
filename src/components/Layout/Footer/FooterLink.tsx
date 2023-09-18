import Link from "next/link";
import { FC } from "react";

export type Props = {
	name: string;
	url: string;
};

const FooterLink: FC<Props> = ({ name, url }) => {
	return (
		<li className="links__item">
			<Link href={url} className="links__link ">
				{name}
			</Link>
		</li>
	);
};

export default FooterLink;

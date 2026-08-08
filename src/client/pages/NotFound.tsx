import { Link } from "react-router-dom";
import { useI18n } from "@/lib/i18n";

export default function NotFound() {
	const { t } = useI18n();

	return (
		<div className="mx-auto mt-32 max-w-md text-center">
			<div className="text-6xl" aria-hidden="true">
				🥚
			</div>
			<h1 className="mt-6 text-3xl font-extrabold">{t("gate.notFound.title")}</h1>
			<p className="mt-3 text-muted">{t("gate.notFound.body")}</p>
			<Link to="/" className="btn-primary mt-8">
				{t("gate.home")}
			</Link>
		</div>
	);
}

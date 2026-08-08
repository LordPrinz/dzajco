import { useState } from "react";
import { CheckIcon, CopyIcon } from "./Icons";
import { useI18n } from "@/lib/i18n";

/** Clipboard write with a `document.execCommand` fallback for older Safari. */
async function copy(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		try {
			const field = document.createElement("textarea");
			field.value = text;
			field.style.position = "fixed";
			field.style.opacity = "0";
			document.body.appendChild(field);
			field.select();
			const ok = document.execCommand("copy");
			field.remove();
			return ok;
		} catch {
			return false;
		}
	}
}

export default function CopyButton({
	value,
	label,
	className = "btn-ghost px-4 py-2 text-sm",
}: {
	value: string;
	label?: string;
	className?: string;
}) {
	const { t } = useI18n();
	const [done, setDone] = useState(false);

	return (
		<button
			type="button"
			className={className}
			onClick={async () => {
				if (!(await copy(value))) return;
				setDone(true);
				setTimeout(() => setDone(false), 2000);
			}}
			aria-label={label ?? t("result.copy")}>
			{done ? <CheckIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
			<span>{done ? t("result.copied") : (label ?? t("result.copy"))}</span>
		</button>
	);
}

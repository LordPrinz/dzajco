import { useEffect, useRef } from "react";

declare global {
	interface Window {
		turnstile?: {
			render: (
				element: HTMLElement,
				options: {
					sitekey: string;
					callback: (token: string) => void;
					"error-callback"?: () => void;
					"expired-callback"?: () => void;
					theme?: "auto" | "light" | "dark";
					size?: "normal" | "flexible" | "compact";
				}
			) => string;
			remove: (id: string) => void;
			reset: (id: string) => void;
		};
	}
}

const SCRIPT_SRC =
	"https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
	if (window.turnstile) return Promise.resolve();

	scriptPromise ??= new Promise<void>((resolve, reject) => {
		const script = document.createElement("script");
		script.src = SCRIPT_SRC;
		script.async = true;
		script.defer = true;
		script.onload = () => resolve();
		script.onerror = () => {
			scriptPromise = null; // allow a retry on the next mount
			reject(new Error("turnstile failed to load"));
		};
		document.head.appendChild(script);
	});

	return scriptPromise;
}

/**
 * Cloudflare Turnstile, rendered explicitly so it only loads for anonymous
 * visitors on the create form. Signed-in users never see it.
 *
 * The widget is invisible for the vast majority of visitors — it is here to make
 * scripted link creation expensive, not to put a puzzle in front of people.
 */
export default function Turnstile({
	siteKey,
	onToken,
}: {
	siteKey: string;
	onToken: (token: string | null) => void;
}) {
	const container = useRef<HTMLDivElement>(null);
	// Kept in a ref so the effect does not re-run when the callback identity
	// changes on a parent render.
	const callback = useRef(onToken);
	callback.current = onToken;

	useEffect(() => {
		let widgetId: string | undefined;
		let cancelled = false;

		void loadScript()
			.then(() => {
				if (cancelled || !container.current || !window.turnstile) return;

				widgetId = window.turnstile.render(container.current, {
					sitekey: siteKey,
					theme: "auto",
					size: "flexible",
					callback: (token) => callback.current(token),
					"error-callback": () => callback.current(null),
					"expired-callback": () => callback.current(null),
				});
			})
			.catch(() => {
				// Without the widget the request is still rate-limited, and the
				// server rejects it when a secret is configured.
				callback.current(null);
			});

		return () => {
			cancelled = true;
			if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
		};
	}, [siteKey]);

	return <div ref={container} className="min-h-[65px]" />;
}

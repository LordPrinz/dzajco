import {
	createContext,
	useCallback,
	useContext,
	useMemo,
	useState,
	type ReactNode,
} from "react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; message: string };

type ToastValue = {
	success: (message: string) => void;
	error: (message: string) => void;
	info: (message: string) => void;
};

const ToastContext = createContext<ToastValue | null>(null);

const TONE_STYLES: Record<Tone, string> = {
	success: "border-jajco-400 bg-jajco-50 text-jajco-950",
	error: "border-red-300 bg-red-50 text-red-900",
	info: "border-edge bg-surface text-ink",
};

const DISMISS_AFTER_MS = 5000;

export function ToastProvider({ children }: { children: ReactNode }) {
	const [toasts, setToasts] = useState<Toast[]>([]);

	const push = useCallback((tone: Tone, message: string) => {
		const id = Date.now() + Math.random();
		setToasts((current) => [...current, { id, tone, message }]);
		setTimeout(
			() => setToasts((current) => current.filter((toast) => toast.id !== id)),
			DISMISS_AFTER_MS
		);
	}, []);

	const value = useMemo<ToastValue>(
		() => ({
			success: (message) => push("success", message),
			error: (message) => push("error", message),
			info: (message) => push("info", message),
		}),
		[push]
	);

	return (
		<ToastContext.Provider value={value}>
			{children}
			<div
				className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2"
				role="status"
				aria-live="polite">
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`pointer-events-auto animate-fade-up rounded-xl border px-4 py-3 text-sm font-semibold shadow-lift ${
							TONE_STYLES[toast.tone]
						}`}>
						{toast.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast(): ToastValue {
	const value = useContext(ToastContext);
	if (!value) throw new Error("useToast must be used inside ToastProvider");
	return value;
}

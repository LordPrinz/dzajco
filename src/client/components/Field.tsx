import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type FieldProps = {
	label: string;
	hint?: string;
	error?: string | null;
	optional?: boolean;
	children?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "className">;

/**
 * Labelled input. The label is always rendered (never a placeholder standing in
 * for one) so the advanced panel stays readable with a screen reader and after
 * the fields have values.
 */
export default function Field({
	label,
	hint,
	error,
	optional,
	children,
	...input
}: FieldProps) {
	const id = useId();
	const describedBy = hint || error ? `${id}-hint` : undefined;

	return (
		<div>
			<label htmlFor={id} className="label">
				{label}
				{optional && <span className="ml-1 font-normal normal-case text-faint">·</span>}
			</label>

			{children ?? (
				<input
					id={id}
					aria-describedby={describedBy}
					aria-invalid={error ? true : undefined}
					className={`input-sm ${error ? "border-red-400 focus:ring-red-300/50" : ""}`}
					{...input}
				/>
			)}

			{(hint || error) && (
				<p
					id={describedBy}
					className={`mt-1.5 text-xs ${error ? "text-red-500" : "text-faint"}`}>
					{error ?? hint}
				</p>
			)}
		</div>
	);
}

export function Toggle({
	label,
	hint,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	hint?: string;
	checked: boolean;
	onChange: (value: boolean) => void;
	disabled?: boolean;
}) {
	const id = useId();

	return (
		<div className={disabled ? "opacity-60" : undefined}>
			<div className="flex items-center gap-3">
				<button
					id={id}
					type="button"
					role="switch"
					aria-checked={checked}
					disabled={disabled}
					onClick={() => onChange(!checked)}
					className={`relative h-6 w-11 shrink-0 rounded-full border transition ${
						checked
							? "border-jajco-500 bg-jajco-400"
							: "border-edge bg-sunken"
					} ${disabled ? "cursor-not-allowed" : ""}`}>
					<span
						className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
							checked ? "left-6" : "left-0.5"
						}`}
					/>
				</button>
				<label htmlFor={id} className="text-sm font-semibold text-ink">
					{label}
				</label>
			</div>
			{hint && <p className="mt-1.5 text-xs text-faint">{hint}</p>}
		</div>
	);
}

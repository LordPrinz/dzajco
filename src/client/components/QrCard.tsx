import { useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { DownloadIcon } from "./Icons";

const SIZES = [256, 512, 1024] as const;
type Size = (typeof SIZES)[number];

/**
 * QR codes are rendered in the browser rather than on the Worker: it costs the
 * free plan nothing, works offline once the chunk is cached, and the image never
 * has to round-trip. The `qrcode` chunk is split out in the Vite config, so the
 * landing page does not pay for it until a link actually exists.
 */
export default function QrCard({ url }: { url: string }) {
	const { t } = useI18n();
	const [size, setSize] = useState<Size>(512);
	const [preview, setPreview] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);

	const options = useMemo(
		() => ({
			// Error correction M keeps the code readable when it is printed small
			// or partially obscured, without inflating the module count.
			errorCorrectionLevel: "M" as const,
			margin: 2,
			color: { dark: "#111827", light: "#ffffff" },
		}),
		[]
	);

	useEffect(() => {
		let cancelled = false;

		void import("qrcode")
			.then(({ default: QRCode }) =>
				QRCode.toDataURL(url, { ...options, width: 320 })
			)
			.then((dataUrl) => {
				if (!cancelled) setPreview(dataUrl);
			})
			.catch(() => {
				if (!cancelled) setFailed(true);
			});

		return () => {
			cancelled = true;
		};
	}, [url, options]);

	const download = async (format: "png" | "svg") => {
		const { default: QRCode } = await import("qrcode");

		const href =
			format === "png"
				? await QRCode.toDataURL(url, { ...options, width: size })
				: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
						await QRCode.toString(url, { ...options, type: "svg", width: size })
					)}`;

		const anchor = document.createElement("a");
		anchor.href = href;
		anchor.download = `dzajco-qr.${format}`;
		anchor.click();
	};

	return (
		<div className="flex flex-col items-center gap-4">
			<div className="rounded-2xl border border-edge bg-white p-3 shadow-sm">
				{preview ? (
					<img
						src={preview}
						alt={t("result.qr")}
						width={200}
						height={200}
						className="h-[200px] w-[200px]"
					/>
				) : (
					<div className="skeleton h-[200px] w-[200px] rounded-lg" />
				)}
			</div>

			{failed ? (
				<p className="text-xs text-faint">{t("error.generic")}</p>
			) : (
				<div className="flex flex-wrap items-center justify-center gap-2">
					<label className="sr-only" htmlFor="qr-size">
						{t("qr.size")}
					</label>
					<select
						id="qr-size"
						value={size}
						onChange={(event) => setSize(Number(event.target.value) as Size)}
						className="input-sm w-auto py-2 text-sm">
						{SIZES.map((value) => (
							<option key={value} value={value}>
								{value}×{value}
							</option>
						))}
					</select>

					<button
						type="button"
						className="btn-ghost px-4 py-2 text-sm"
						onClick={() => void download("png")}>
						<DownloadIcon className="h-4 w-4" /> PNG
					</button>
					<button
						type="button"
						className="btn-ghost px-4 py-2 text-sm"
						onClick={() => void download("svg")}>
						<DownloadIcon className="h-4 w-4" /> SVG
					</button>
				</div>
			)}
		</div>
	);
}

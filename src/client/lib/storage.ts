import type { OwnerProfile, OwnerProfileEntry } from "@shared/types";

const KEY = "dzajco:profile";

/**
 * The anonymous owner profile.
 *
 * For links created without an account, the secret returned at creation time is
 * the *only* proof of ownership — it is stored hashed on the server, so a lost
 * secret cannot be recovered. It lives here, and the export/import pair below is
 * how it survives a cleared browser or moves to another device.
 */
export function readProfile(): OwnerProfileEntry[] {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return [];

		const parsed = JSON.parse(raw) as OwnerProfile | OwnerProfileEntry[];
		const entries = Array.isArray(parsed) ? parsed : parsed.links;
		return entries.filter(
			(entry): entry is OwnerProfileEntry =>
				typeof entry?.code === "string" && typeof entry?.secret === "string"
		);
	} catch {
		return [];
	}
}

function write(entries: OwnerProfileEntry[]): void {
	try {
		localStorage.setItem(
			KEY,
			JSON.stringify({
				version: 1,
				exportedAt: new Date().toISOString(),
				links: entries,
			} satisfies OwnerProfile)
		);
		window.dispatchEvent(new CustomEvent("dzajco:profile"));
	} catch {
		// Private-mode quota. The link still works; only the local record is lost.
	}
}

export function rememberLink(entry: OwnerProfileEntry): void {
	const entries = readProfile().filter((item) => item.code !== entry.code);
	entries.unshift(entry);
	write(entries.slice(0, 500));
}

export function forgetLink(code: string): void {
	write(readProfile().filter((entry) => entry.code !== code));
}

export function secretFor(code: string): string | undefined {
	return readProfile().find((entry) => entry.code === code)?.secret;
}

export function exportProfile(): void {
	const payload: OwnerProfile = {
		version: 1,
		exportedAt: new Date().toISOString(),
		links: readProfile(),
	};

	const blob = new Blob([JSON.stringify(payload, null, 2)], {
		type: "application/json",
	});
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");

	anchor.href = url;
	anchor.download = `dzajco-profile-${new Date().toISOString().slice(0, 10)}.json`;
	anchor.click();

	URL.revokeObjectURL(url);
}

/** Merges an exported profile into the current one. Returns links added. */
export function importProfile(raw: string): number {
	const parsed = JSON.parse(raw) as OwnerProfile;
	const incoming = Array.isArray(parsed) ? parsed : parsed?.links;

	if (!Array.isArray(incoming)) throw new Error("unrecognised file");

	const existing = readProfile();
	const known = new Set(existing.map((entry) => entry.code));
	let added = 0;

	for (const entry of incoming) {
		if (typeof entry?.code !== "string" || typeof entry?.secret !== "string") {
			continue;
		}
		if (known.has(entry.code)) continue;
		existing.push(entry);
		known.add(entry.code);
		added++;
	}

	write(existing);
	return added;
}

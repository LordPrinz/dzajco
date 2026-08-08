import { useCallback, useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "dzajco:theme";

function current(): Theme {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * The initial class is applied by an inline script in index.html so the page
 * never flashes the wrong palette; this hook only handles later toggles.
 */
export function useTheme(): [Theme, () => void] {
	const [theme, setTheme] = useState<Theme>(current);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		try {
			localStorage.setItem(KEY, theme);
		} catch {
			// Preference is session-only.
		}
	}, [theme]);

	const toggle = useCallback(
		() => setTheme((value) => (value === "dark" ? "light" : "dark")),
		[]
	);

	return [theme, toggle];
}

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import type { MeResponse } from "@shared/types";
import { api } from "./api";

type SessionValue = MeResponse & {
	loading: boolean;
	refresh: () => Promise<void>;
	signOut: () => Promise<void>;
};

const EMPTY: MeResponse = { user: null, turnstileSiteKey: null, providers: [] };

const SessionContext = createContext<SessionValue | null>(null);

/**
 * One `/api/auth/me` call for the whole app. It also carries the Turnstile site
 * key and the list of configured providers, so the UI can hide sign-in buttons
 * and the bot widget when a deployment has not set them up.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
	const [state, setState] = useState<MeResponse>(EMPTY);
	const [loading, setLoading] = useState(true);

	const refresh = useCallback(async () => {
		try {
			setState(await api.me());
		} catch {
			setState(EMPTY);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void refresh();
	}, [refresh]);

	const signOut = useCallback(async () => {
		try {
			await api.logout();
		} finally {
			setState((previous) => ({ ...previous, user: null }));
		}
	}, []);

	const value = useMemo<SessionValue>(
		() => ({ ...state, loading, refresh, signOut }),
		[state, loading, refresh, signOut]
	);

	return (
		<SessionContext.Provider value={value}>{children}</SessionContext.Provider>
	);
}

export function useSession(): SessionValue {
	const value = useContext(SessionContext);
	if (!value) throw new Error("useSession must be used inside SessionProvider");
	return value;
}

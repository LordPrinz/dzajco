import { BrowserRouter, Route, Routes } from "react-router-dom";
import Layout from "@/components/Layout";
import { I18nProvider } from "@/lib/i18n";
import { SessionProvider } from "@/lib/session";
import { ToastProvider } from "@/components/Toast";
import Home from "@/pages/Home";
import Stats from "@/pages/Stats";
import Gate from "@/pages/Gate";
import History from "@/pages/History";
import Dashboard from "@/pages/Dashboard";
import About from "@/pages/About";
import Login from "@/pages/Login";
import ApiDocs from "@/pages/ApiDocs";
import Privacy from "@/pages/Privacy";
import NotFound from "@/pages/NotFound";

export default function App() {
	return (
		<I18nProvider>
			<SessionProvider>
				<ToastProvider>
					<BrowserRouter>
						<Layout>
							<Routes>
								<Route path="/" element={<Home />} />
								<Route path="/history" element={<History />} />
								<Route path="/dashboard" element={<Dashboard />} />
								<Route path="/about" element={<About />} />
								<Route path="/login" element={<Login />} />
								<Route path="/api-docs" element={<ApiDocs />} />
								<Route path="/privacy-policy" element={<Privacy />} />

								<Route path="/:code/info" element={<Stats />} />
								{/*
								  Reached only when the Worker declined to redirect —
								  the link is missing, scheduled, expired, disabled,
								  capped or password-protected. Declared after the
								  static routes so it never shadows them.
								*/}
								<Route path="/:code" element={<Gate />} />

								<Route path="*" element={<NotFound />} />
							</Routes>
						</Layout>
					</BrowserRouter>
				</ToastProvider>
			</SessionProvider>
		</I18nProvider>
	);
}

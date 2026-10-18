import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "../../admin/src/styles/globals.css";
import { initStore, useSession } from "./data/store";
import { canAccess } from "./lib";
import { Shell } from "./components/Shell";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { Reservations } from "./pages/Reservations";
import { ReservationNew } from "./pages/ReservationNew";
import { ReservationDetail } from "./pages/ReservationDetail";
import { CalendarPage } from "./pages/Calendar";
import { GuestDetail, Guests } from "./pages/Guests";
import { Rooms } from "./pages/Rooms";
import { Housekeeping } from "./pages/Housekeeping";
import { Inventory } from "./pages/Inventory";
import { Messages } from "./pages/Messages";
import { Offers } from "./pages/Offers";
import { Channels } from "./pages/Channels";
import { Rates } from "./pages/Rates";
import { Invoices } from "./pages/Invoices";
import { Reports } from "./pages/Reports";
import { Analytics } from "./pages/Analytics";
import { Account, Settings } from "./pages/Settings";
import { GuestCheckin, GuestOffers, GuestPayment, GuestWelcome } from "./pages/Guest";

function Protected({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const { pathname } = useLocation();
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(pathname)}`} replace />;
  if (!canAccess(session.role, pathname)) return <Navigate to={["housekeeping", "maintenance"].includes(session.role) ? "/curatenie" : "/"} replace />;
  return <Shell>{children}</Shell>;
}

function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const admin: [string, React.ReactNode][] = [
  ["/", <Dashboard />], ["/rezervari", <Reservations />], ["/rezervari/noua", <ReservationNew />], ["/rezervari/:id", <ReservationDetail />],
  ["/calendar", <CalendarPage />], ["/oaspeti", <Guests />], ["/oaspeti/:id", <GuestDetail />], ["/camere", <Rooms />], ["/curatenie", <Housekeeping />],
  ["/consumabile", <Inventory />], ["/mesaje", <Messages />], ["/oferte", <Offers />], ["/canale", <Channels />], ["/tarife", <Rates />],
  ["/facturi", <Invoices />], ["/rapoarte", <Reports />], ["/analitice", <Analytics />], ["/setari", <Settings />], ["/cont", <Account />],
];

function App() {
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    initStore().then(() => setState("ready"), () => setState("error"));
  }, []);
  if (state !== "ready") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-navy-900 text-ivory-50">
        <img src={`${import.meta.env.BASE_URL}brand/adonis-logo-horizontal-on-dark.svg`} alt="Hostel Adonis Costinești" className="h-16" />
        <p className="text-sm text-navy-300">{state === "loading" ? "Se pregătește casa…" : "Nu am putut încărca datele. Verificați conexiunea și reîncărcați pagina."}</p>
      </div>
    );
  }
  return (
    <HashRouter>
      <ScrollTop />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/oaspete/:token" element={<GuestWelcome />} />
        <Route path="/oaspete/:token/checkin" element={<GuestCheckin />} />
        <Route path="/oaspete/:token/oferte" element={<GuestOffers />} />
        <Route path="/plata/:id" element={<GuestPayment />} />
        {admin.map(([path, el]) => (
          <Route key={path} path={path} element={<Protected>{el}</Protected>} />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {}));
}

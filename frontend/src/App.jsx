import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import AccountHub from "./pages/AccountHub";
import Analytics from "./pages/Analytics";
import Calendar from "./pages/Calendar";
import CarouselCreator from "./pages/CarouselCreator";
import Composer from "./pages/Composer";
import Goals from "./pages/Goals";
import Inbox from "./pages/Inbox";
import Library from "./pages/Library";
import Pillars from "./pages/Pillars";
import PlanChecklist from "./pages/PlanChecklist";
import Queue from "./pages/Queue";
import Settings from "./pages/Settings";
import UTMBuilder from "./pages/UTMBuilder";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/accounts" replace />} />
        <Route path="accounts" element={<AccountHub />} />
        <Route path="composer" element={<Composer />} />
        <Route path="carousel" element={<CarouselCreator />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="queue" element={<Queue />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="library" element={<Library />} />
        <Route path="pillars" element={<Pillars />} />
        <Route path="goals" element={<Goals />} />
        <Route path="utm" element={<UTMBuilder />} />
        <Route path="plan" element={<PlanChecklist />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

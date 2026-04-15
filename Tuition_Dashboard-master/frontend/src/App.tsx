import { BrowserRouter, Routes, Route } from "react-router-dom";
import Welcome from "./components/Welcome";
import DashboardGrid from "./components/DashboardGrid";
import ClosuresManager from "./components/ClosuresManager";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Welcome />} />
        <Route path="/dashboard" element={<DashboardGrid />} />
        <Route path="/closures" element={<ClosuresManager />} />
      </Routes>
    </BrowserRouter>
  );
}

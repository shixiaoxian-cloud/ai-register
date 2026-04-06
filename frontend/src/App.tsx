import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ArtifactsPage } from "./pages/ArtifactsPage";
import { ConfigCenterPage } from "./pages/ConfigCenterPage";
import { OverviewPage } from "./pages/OverviewPage";
import { RunsPage } from "./pages/RunsPage";
import { TaskCenterPage } from "./pages/TaskCenterPage";
import { SystemPage } from "./pages/SystemPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<OverviewPage />} />
          <Route path="/config" element={<ConfigCenterPage />} />
          <Route path="/runs" element={<RunsPage />} />
          <Route path="/tasks" element={<TaskCenterPage />} />
          <Route path="/artifacts" element={<ArtifactsPage />} />
          <Route path="/system" element={<SystemPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

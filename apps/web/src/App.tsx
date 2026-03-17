import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import AppLayout from "./layout/AppLayout";
import DashboardPage from "./pages/DashboardPage";
import ClaudePage from "./pages/ClaudePage";
import ChatGPTPage from "./pages/ChatGPTPage";
import GeminiPage from "./pages/GeminiPage";
import ImagePage from "./pages/ImagePage";
import VideoPage from "./pages/VideoPage";
import AudioPage from "./pages/AudioPage";
import AvatarPage from "./pages/AvatarPage";
import FilesPage from "./pages/FilesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/claude" element={<ClaudePage />} />
          <Route path="/chatgpt" element={<ChatGPTPage />} />
          <Route path="/gemini" element={<GeminiPage />} />
          <Route path="/image" element={<ImagePage />} />
          <Route path="/video" element={<VideoPage />} />
          <Route path="/audio" element={<AudioPage />} />
          <Route path="/avatar" element={<AvatarPage />} />
          <Route path="/files" element={<FilesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

import { Outlet } from "react-router-dom";
import { VoiceAssistant } from "../assistant/VoiceAssistant";
import { Footer } from "./Footer";
import { Navbar } from "./Navbar";

export function AppLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-white">
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <VoiceAssistant />
    </div>
  );
}

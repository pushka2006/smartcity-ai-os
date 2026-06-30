import "./index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/Shell";
import { ToastProvider } from "./components/Toast";
import { SecurityProvider } from "./lib/SecurityContext";
import { VoiceProvider } from "./lib/VoiceContext";
import CommandCenter from "./pages/CommandCenter";
import ChatHub from "./pages/ChatHub";
import AgentsHub from "./pages/AgentsHub";
import MemoryCenter from "./pages/MemoryCenter";
import KnowledgeBase from "./pages/KnowledgeBase";
import CodeAssistant from "./pages/CodeAssistant";
import TerminalConsole from "./pages/TerminalConsole";
import BrowserConsole from "./pages/BrowserConsole";
import TaskManager from "./pages/TaskManager";
import SystemMonitor from "./pages/SystemMonitor";
import Settings from "./pages/Settings";
import BiometricSecurity from "./pages/BiometricSecurity";
import CameraConsole from "./pages/CameraConsole";
import ParticlePlayground from "./pages/ParticlePlayground";
import AnimationStudio from "./pages/AnimationStudio";
import HandParticleStudio from "./pages/HandParticleStudio";
import MockAuth from "./pages/MockAuth";
import TrafficPrediction from "./pages/TrafficPrediction";

function App() {
  return (
    <ToastProvider>
      <SecurityProvider>
        <div className="nx-grid-bg min-h-screen text-white">
          <BrowserRouter>
            <VoiceProvider>
              <Shell>
                <Routes>
                  <Route path="/"          element={<CommandCenter />} />
                  <Route path="/chat"      element={<ChatHub />} />
                  <Route path="/agents"    element={<AgentsHub />} />
                  <Route path="/memory"    element={<MemoryCenter />} />
                  <Route path="/knowledge" element={<KnowledgeBase />} />
                  <Route path="/code"      element={<CodeAssistant />} />
                  <Route path="/terminal"  element={<TerminalConsole />} />
                  <Route path="/browser"   element={<BrowserConsole />} />
                  <Route path="/tasks"     element={<TaskManager />} />
                  <Route path="/monitor"   element={<SystemMonitor />} />
                  <Route path="/settings"  element={<Settings />} />
                  <Route path="/biometrics"element={<BiometricSecurity />} />
                  <Route path="/camera"    element={<CameraConsole />} />
                  <Route path="/particles" element={<ParticlePlayground />} />
                  <Route path="/animate"   element={<AnimationStudio />} />
                  <Route path="/handanim"  element={<HandParticleStudio />} />
                  <Route path="/traffic"   element={<TrafficPrediction />} />
                  <Route path="/auth/mock/:provider" element={<MockAuth />} />
                  <Route path="*"          element={<Navigate to="/" replace />} />
                </Routes>
              </Shell>
            </VoiceProvider>
          </BrowserRouter>
        </div>
      </SecurityProvider>
    </ToastProvider>
  );
}

export default App;

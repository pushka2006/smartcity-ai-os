import { useState, useEffect } from "react";
import "./index.css";
import { HashRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/Shell";
import { ToastProvider } from "./components/Toast";
import { SecurityProvider } from "./lib/SecurityContext";
import { VoiceProvider } from "./lib/VoiceContext";
import { ErrorFixerProvider } from "./lib/ErrorFixerContext";
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
import UrbanIntelligence from "./pages/UrbanIntelligence";
import UiPlayground from "./pages/UiPlayground";
import NexusHologram from "./pages/NexusHologram";
import VirtualFace from "./pages/VirtualFace";
import CityCenter3D from "./pages/CityCenter3D";
import InfinityPage from "./pages/Infinity";
import ErrorFixerAI from "./pages/ErrorFixerAI";
import PhoneDialer from "./pages/PhoneDialer";
import { ParticleBackground } from "./components/ui";



function App() {
  const [particleSettings, setParticleSettings] = useState(() => {
    const defaults = {
      color: "#00F5FF",
      count: 80,
      speed: 0.6,
      interactive: true,
      interactiveMode: "magnet",
      connectionLines: true,
      lineDistance: 110,
    };
    try {
      const stored = localStorage.getItem("nexus_particle_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.fullscreen) {
          return {
            color: parsed.color || defaults.color,
            count: parsed.count !== undefined ? parsed.count : defaults.count,
            speed: parsed.speed !== undefined ? parsed.speed : defaults.speed,
            interactive: parsed.interactive !== undefined ? parsed.interactive : defaults.interactive,
            interactiveMode: parsed.interactiveMode || defaults.interactiveMode,
            connectionLines: parsed.connectionLines !== undefined ? parsed.connectionLines : defaults.connectionLines,
            lineDistance: parsed.lineDistance !== undefined ? parsed.lineDistance : defaults.lineDistance,
          };
        }
      }
    } catch (e) {}
    return defaults;
  });

  useEffect(() => {
    const handleUpdate = () => {
      try {
        const defaults = {
          color: "#00F5FF",
          count: 80,
          speed: 0.6,
          interactive: true,
          interactiveMode: "magnet",
          connectionLines: true,
          lineDistance: 110,
        };
        const stored = localStorage.getItem("nexus_particle_settings");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (parsed.fullscreen) {
            setParticleSettings({
              color: parsed.color || defaults.color,
              count: parsed.count !== undefined ? parsed.count : defaults.count,
              speed: parsed.speed !== undefined ? parsed.speed : defaults.speed,
              interactive: parsed.interactive !== undefined ? parsed.interactive : defaults.interactive,
              interactiveMode: parsed.interactiveMode || defaults.interactiveMode,
              connectionLines: parsed.connectionLines !== undefined ? parsed.connectionLines : defaults.connectionLines,
              lineDistance: parsed.lineDistance !== undefined ? parsed.lineDistance : defaults.lineDistance,
            });
            return;
          }
        }
        setParticleSettings(defaults);
      } catch (e) {}
    };
    window.addEventListener("nexus-particle-settings-updated", handleUpdate);
    return () => window.removeEventListener("nexus-particle-settings-updated", handleUpdate);
  }, []);

  return (
    <ToastProvider>
      <SecurityProvider>
        <ErrorFixerProvider>
          <div className="nx-grid-bg min-h-screen text-white" style={{ position: "relative" }}>
          <ParticleBackground
            fullscreen={true}
            count={particleSettings.count}
            speed={particleSettings.speed}
            color={particleSettings.color}
            interactive={particleSettings.interactive}
            interactiveMode={particleSettings.interactiveMode}
            connectionLines={particleSettings.connectionLines}
            lineDistance={particleSettings.lineDistance}
          />
          <div style={{ position: "relative", zIndex: 1 }}>
            <Router>
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
                    <Route path="/urban"     element={<UrbanIntelligence />} />
                    <Route path="/ui-playground" element={<UiPlayground />} />
                    <Route path="/hologram" element={<NexusHologram />} />
                    <Route path="/virtualface" element={<VirtualFace />} />
                    <Route path="/3dcity" element={<CityCenter3D />} />
                    <Route path="/infinity" element={<InfinityPage />} />
                    <Route path="/auth/mock/:provider" element={<MockAuth />} />
                    <Route path="/error-fixer" element={<ErrorFixerAI />} />
                    <Route path="/phone" element={<PhoneDialer />} />
                    <Route path="*"          element={<Navigate to="/" replace />} />
                  </Routes>
                </Shell>
              </VoiceProvider>
            </Router>
          </div>
        </div>
        </ErrorFixerProvider>
      </SecurityProvider>
    </ToastProvider>
  );
}

export default App;

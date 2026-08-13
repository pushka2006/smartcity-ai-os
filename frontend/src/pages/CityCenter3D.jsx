import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  Users, Car, Leaf, Zap, Droplet, HeartPulse, Search, Bell, User, Brain,
  AlertTriangle, Info, CheckCircle, TrendingUp, TrendingDown, Sun, CloudRain,
  CloudLightning, RotateCw, Plus, Minus, Maximize2, Layers, MapPin, Flame,
  Shield, Crosshair, Send, Sparkles, Cpu, Wifi, MessageSquare, Radio, RefreshCw,
  ChevronRight, Eye, Camera, Hospital, Trash2, Globe, Activity, Volume2, VolumeX, Upload
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Tooltip, XAxis, YAxis
} from "recharts";
import GlassCard from "../components/ui/GlassCard";
import { speak } from "../lib/tts";
import { streamChat } from "../lib/api";

// ─── Constants: Districts Configuration ──────────────────────────────────────
const DISTRICTS = [
  { id: "core", name: "Infinity Core", color: "#00F5FF", desc: "Central System Node & Neural Net", code: "CORE-01" },
  { id: "financial", name: "Financial District", color: "#10B981", desc: "Stock Exchange & Crypto Vault", code: "FIN-02" },
  { id: "shopping", name: "Shopping District", color: "#EC4899", desc: "E-Commerce Hub & Drone Logistics", code: "SHOP-03" },
  { id: "entertainment", name: "Entertainment District", color: "#D946EF", desc: "Synthwave Beats & Social Matrix", code: "ENT-04" },
  { id: "medical", name: "Medical District", color: "#EF4444", desc: "Bio-Telemetry & Diagnosis Lab", code: "MED-05" },
  { id: "smarthome", name: "Smart Home District", color: "#8B5CF6", desc: "IoT Sensors & Building Automation", code: "HOME-06" },
  { id: "transport", name: "Transport District", color: "#F59E0B", desc: "Autonomous Transit & Metro Grid", code: "TRANS-07" },
  { id: "education", name: "Education District", color: "#FBBF24", desc: "Coding Sandbox & AI Tutor", code: "EDU-08" },
  { id: "productivity", name: "Productivity District", color: "#3B82F6", desc: "System Workspace & Tasks Core", code: "PROD-09" },
  { id: "security", name: "Security District", color: "#94A3B8", desc: "Quantum Firewall & Port Sentinel", code: "SEC-10" }
];

// ─── Helper function to classify buildings into districts ────────────────────
const getDistrictByCoords = (x, z) => {
  const dist = Math.sqrt(x * x + z * z);
  if (dist < 2.5) return DISTRICTS[0]; // core
  if (dist > 10.5) return DISTRICTS[9]; // security
  
  const angle = Math.atan2(z, x) + Math.PI; // 0 to 2*PI
  const segment = Math.floor((angle / (2 * Math.PI)) * 8) % 8;
  
  const midDistricts = [
    DISTRICTS[1], // financial
    DISTRICTS[2], // shopping
    DISTRICTS[3], // entertainment
    DISTRICTS[4], // medical
    DISTRICTS[5], // smarthome
    DISTRICTS[6], // transport
    DISTRICTS[7], // education
    DISTRICTS[8]  // productivity
  ];
  return midDistricts[segment];
};

// ─── Camera Controls Component using JSM OrbitControls ───────────────────────
function CameraControls({ autoRotate, targetPos, is2D, zoomInCounter, zoomOutCounter }) {
  const { camera, gl } = useThree();
  const controlsRef = useRef();
  const prevZoomIn = useRef(zoomInCounter);
  const prevZoomOut = useRef(zoomOutCounter);

  useEffect(() => {
    const controls = new OrbitControls(camera, gl.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 - 0.05;
    controls.minDistance = 3;
    controls.maxDistance = 38;
    controlsRef.current = controls;

    return () => {
      controls.dispose();
    };
  }, [camera, gl]);

  useEffect(() => {
    if (controlsRef.current && targetPos) {
      const controls = controlsRef.current;
      const targetVec = new THREE.Vector3(targetPos.x, 0.5, targetPos.z);
      let progress = 0;
      const anim = () => {
        if (progress < 1) {
          progress += 0.08;
          controls.target.lerp(targetVec, 0.1);
          requestAnimationFrame(anim);
        }
      };
      anim();
    }
  }, [targetPos]);

  useEffect(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      if (is2D) {
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = 0.01;
        const target = controls.target;
        camera.position.set(target.x, 24, target.z);
        controls.update();
      } else {
        controls.minPolarAngle = 0;
        controls.maxPolarAngle = Math.PI / 2 - 0.05;
        const target = controls.target;
        camera.position.set(target.x + 8, target.y + 12, target.z + 14);
        controls.update();
      }
    }
  }, [is2D, camera]);

  useEffect(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      if (zoomInCounter > prevZoomIn.current) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, 2.5);
        controls.update();
        prevZoomIn.current = zoomInCounter;
      }
    }
  }, [zoomInCounter, camera]);

  useEffect(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      if (zoomOutCounter > prevZoomOut.current) {
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        camera.position.addScaledVector(dir, -2.5);
        controls.update();
        prevZoomOut.current = zoomOutCounter;
      }
    }
  }, [zoomOutCounter, camera]);

  useFrame(() => {
    if (controlsRef.current) {
      if (autoRotate) {
        controlsRef.current.autoRotate = true;
        controlsRef.current.autoRotateSpeed = 0.6;
      } else {
        controlsRef.current.autoRotate = false;
      }
      controlsRef.current.update();
      
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      const angleRad = Math.atan2(dir.x, dir.z);
      const angleDeg = (angleRad * 180) / Math.PI;
      const event = new CustomEvent("nexus-camera-rotate", { detail: { angle: angleDeg } });
      window.dispatchEvent(event);
    }
  });

  return null;
}

// Global cache for helipads
const helipadTextures = {};
function getHelipadTexture(glowColor) {
  if (helipadTextures[glowColor]) return helipadTextures[glowColor];
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  
  // Base
  ctx.fillStyle = "#1e293b";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(64, 64, 56, 0, Math.PI * 2);
  ctx.stroke();
  
  // Painted H
  ctx.strokeStyle = glowColor || "#00F5FF";
  ctx.lineWidth = 10;
  ctx.beginPath();
  ctx.moveTo(40, 32); ctx.lineTo(40, 96);
  ctx.moveTo(88, 32); ctx.lineTo(88, 96);
  ctx.moveTo(40, 64); ctx.lineTo(88, 64);
  ctx.stroke();
  
  const texture = new THREE.CanvasTexture(canvas);
  helipadTextures[glowColor] = texture;
  return texture;
}

// ─── Procedural Landmark Geometries ─────────────────────────────────────────
function LandmarkModel({ type, position, glowColor, onSelectLandmark, name }) {
  const meshRef = useRef();
  
  useFrame(({ clock }) => {
    if (meshRef.current && (type === "lotus" || type === "liberty")) {
      meshRef.current.rotation.y = clock.getElapsedTime() * 0.05;
    }
  });

  const getGeometry = () => {
    if (type === "lotus") {
      return (
        <group ref={meshRef}>
          {[...Array(9)].map((_, i) => {
            const angle = (i * Math.PI * 2) / 9;
            return (
              <group key={i} rotation={[0.4, angle, 0.2]}>
                <mesh position={[0, 0.5, 0.8]}>
                  <coneGeometry args={[0.3, 1.2, 3]} />
                  <meshStandardMaterial color="#E0F2FE" emissive={glowColor} emissiveIntensity={1.5} roughness={0.15} metalness={0.1} />
                </mesh>
              </group>
            );
          })}
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.9, 1.0, 0.3, 18]} />
            <meshStandardMaterial color="#CBD5E1" roughness={0.5} />
          </mesh>
        </group>
      );
    }
    
    if (type === "gate") {
      return (
        <group>
          <mesh position={[-0.45, 0.7, 0]}>
            <boxGeometry args={[0.3, 1.4, 0.4]} />
            <meshStandardMaterial color="#D97706" roughness={0.7} />
          </mesh>
          <mesh position={[0.45, 0.7, 0]}>
            <boxGeometry args={[0.3, 1.4, 0.4]} />
            <meshStandardMaterial color="#D97706" roughness={0.7} />
          </mesh>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[1.3, 0.35, 0.55]} />
            <meshStandardMaterial color="#B45309" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.15, 0]}>
            <boxGeometry args={[0.6, 0.3, 0.38]} />
            <meshStandardMaterial color="#78350F" roughness={0.8} />
          </mesh>
          <pointLight position={[0, 0.1, 0]} intensity={4.5} color="#FFD580" distance={10} />
          <pointLight position={[0, 2.0, 0]} intensity={2.5} color="#FFA040" distance={8} />
        </group>
      );
    }
    
    if (type === "minar") {
      return (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.35, 0.4, 0.8, 12]} />
            <meshStandardMaterial color="#D97706" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.3, 0.35, 0.6, 12]} />
            <meshStandardMaterial color="#B45309" roughness={0.6} />
          </mesh>
          <mesh position={[0, 1.7, 0]}>
            <cylinderGeometry args={[0.26, 0.3, 0.6, 12]} />
            <meshStandardMaterial color="#FFC857" roughness={0.6} />
          </mesh>
          <mesh position={[0, 2.2, 0]}>
            <cylinderGeometry args={[0.2, 0.26, 0.4, 12]} />
            <meshStandardMaterial color="#FFE29A" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.8, 0]} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.36, 0.05, 8, 24]} />
            <meshStandardMaterial color="#78350F" />
          </mesh>
          <mesh position={[0, 1.4, 0]} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.31, 0.05, 8, 24]} />
            <meshStandardMaterial color="#78350F" />
          </mesh>
          <mesh position={[0, 2.0, 0]} rotation={[Math.PI/2, 0, 0]}>
            <torusGeometry args={[0.23, 0.04, 8, 24]} />
            <meshStandardMaterial color="#78350F" />
          </mesh>
          <pointLight position={[0, 2.6, 0]} intensity={4.5} color="#FFA040" distance={10} />
          <pointLight position={[0, 1.0, 0]} intensity={2.0} color="#FFE29A" distance={6} />
        </group>
      );
    }
    
    if (type === "eiffel") {
      return (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <coneGeometry args={[0.65, 0.8, 4]} />
            <meshStandardMaterial color="#475569" wireframe roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.25, 0.45, 0.7, 4]} />
            <meshStandardMaterial color="#334155" wireframe roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <coneGeometry args={[0.08, 1.2, 4]} />
            <meshStandardMaterial color="#1E293B" wireframe roughness={0.3} />
          </mesh>
          <pointLight position={[0, 2.6, 0]} intensity={5.0} color="#00F5FF" distance={12} />
          <pointLight position={[0, 1.0, 0]} intensity={2.5} color="#38bdf8" distance={8} />
        </group>
      );
    }

    if (type === "louvre") {
      return (
        <group>
          <mesh position={[0, 0.35, 0]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[1.1, 0.7, 4]} />
            <meshStandardMaterial color="#00F5FF" emissive="#00F5FF" emissiveIntensity={1.2} wireframe roughness={0.1} transparent opacity={0.6} />
          </mesh>
          <pointLight position={[0, 0.2, 0]} intensity={3.0} color="#00F5FF" distance={8} />
        </group>
      );
    }

    if (type === "tokyo_tower") {
      return (
        <group>
          <mesh position={[0, 0.4, 0]}>
            <coneGeometry args={[0.65, 0.8, 4]} />
            <meshStandardMaterial color="#EF4444" wireframe roughness={0.3} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.25, 0.45, 0.7, 4]} />
            <meshStandardMaterial color="#FFFFFF" wireframe roughness={0.3} />
          </mesh>
          <mesh position={[0, 2.0, 0]}>
            <coneGeometry args={[0.08, 1.2, 4]} />
            <meshStandardMaterial color="#EF4444" wireframe roughness={0.3} />
          </mesh>
          <pointLight position={[0, 2.6, 0]} intensity={5.0} color="#EF4444" distance={12} />
          <pointLight position={[0, 1.0, 0]} intensity={2.5} color="#FFFFFF" distance={8} />
        </group>
      );
    }

    if (type === "torii_gate") {
      return (
        <group>
          <mesh position={[-0.45, 0.7, 0]}>
            <boxGeometry args={[0.15, 1.4, 0.15]} />
            <meshStandardMaterial color="#EF4444" roughness={0.5} />
          </mesh>
          <mesh position={[0.45, 0.7, 0]}>
            <boxGeometry args={[0.15, 1.4, 0.15]} />
            <meshStandardMaterial color="#EF4444" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.45, 0]}>
            <boxGeometry args={[1.3, 0.12, 0.18]} />
            <meshStandardMaterial color="#EF4444" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.32, 0]}>
            <boxGeometry args={[1.1, 0.10, 0.14]} />
            <meshStandardMaterial color="#1E293B" roughness={0.5} />
          </mesh>
          <pointLight position={[0, 0.2, 0]} intensity={2.5} color="#EF4444" distance={6} />
        </group>
      );
    }

    if (type === "liberty") {
      return (
        <group ref={meshRef}>
          <mesh position={[0, 0.4, 0]}>
            <boxGeometry args={[0.7, 0.8, 0.7]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1.1, 0]}>
            <cylinderGeometry args={[0.2, 0.28, 0.7, 8]} />
            <meshStandardMaterial color="#4D7C0F" roughness={0.5} />
          </mesh>
          <mesh position={[0, 1.55, 0]}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshStandardMaterial color="#4D7C0F" />
          </mesh>
          <mesh position={[0.15, 1.6, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.4, 4]} />
            <meshStandardMaterial color="#4D7C0F" />
          </mesh>
          <mesh position={[0.15, 1.8, 0]}>
            <sphereGeometry args={[0.06, 6, 6]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
          <pointLight position={[0.15, 1.8, 0]} intensity={4.0} color="#FFD580" distance={9} />
          <pointLight position={[0, 0.5, 0]} intensity={1.8} color="#FFA040" distance={6} />
        </group>
      );
    }

    if (type === "red_fort") {
      return (
        <group>
          <mesh position={[0, 0.3, 0]}>
            <boxGeometry args={[1.8, 0.6, 1.0]} />
            <meshStandardMaterial color="#B45309" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.45, 0.51]}>
            <boxGeometry args={[0.45, 0.5, 0.05]} />
            <meshStandardMaterial color="#78350F" roughness={0.8} />
          </mesh>
          <mesh position={[-0.35, 0.6, 0.4]}>
            <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
            <meshStandardMaterial color="#B45309" roughness={0.7} />
          </mesh>
          <mesh position={[-0.35, 1.25, 0.4]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
          </mesh>
          <mesh position={[0.35, 0.6, 0.4]}>
            <cylinderGeometry args={[0.12, 0.12, 1.2, 8]} />
            <meshStandardMaterial color="#B45309" roughness={0.7} />
          </mesh>
          <mesh position={[0.35, 1.25, 0.4]}>
            <sphereGeometry args={[0.13, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
          </mesh>
          <pointLight position={[0, 0.8, 0.3]} intensity={6.0} color="#FF9F1C" distance={14} />
          <pointLight position={[0, 1.8, 0]} intensity={3.0} color="#FFE29A" distance={8} />
        </group>
      );
    }

    if (type === "jama_masjid") {
      return (
        <group>
          <mesh position={[0, 0.15, 0]}>
            <boxGeometry args={[1.7, 0.3, 1.3]} />
            <meshStandardMaterial color="#E2E8F0" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.45, -0.15]}>
            <boxGeometry args={[1.1, 0.5, 0.55]} />
            <meshStandardMaterial color="#B45309" roughness={0.7} />
          </mesh>
          {[[-0.28, 0.78, -0.15], [0, 0.83, -0.15], [0.28, 0.78, -0.15]].map((pos, idx) => (
            <mesh key={idx} position={pos}>
              <sphereGeometry args={[0.15, 12, 12]} />
              <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
            </mesh>
          ))}
          <mesh position={[-0.7, 0.65, 0.35]}>
            <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
            <meshStandardMaterial color="#B45309" roughness={0.7} />
          </mesh>
          <mesh position={[-0.7, 1.3, 0.35]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
          </mesh>
          <mesh position={[0.7, 0.65, 0.35]}>
            <cylinderGeometry args={[0.07, 0.07, 1.2, 8]} />
            <meshStandardMaterial color="#B45309" roughness={0.7} />
          </mesh>
          <mesh position={[0.7, 1.3, 0.35]}>
            <sphereGeometry args={[0.08, 8, 8]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.1} />
          </mesh>
          <pointLight position={[0, 0.9, 0.2]} intensity={5.0} color="#FFA040" distance={12} />
          <pointLight position={[0, 1.8, 0]} intensity={2.5} color="#FFE29A" distance={8} />
        </group>
      );
    }

    if (type === "akshardham") {
      return (
        <group>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.85, 0.95, 0.4, 16]} />
            <meshStandardMaterial color="#D97706" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.55, 0]}>
            <cylinderGeometry args={[0.65, 0.75, 0.3, 16]} />
            <meshStandardMaterial color="#D97706" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.85, 0]}>
            <sphereGeometry args={[0.32, 16, 16]} />
            <meshStandardMaterial color="#F59E0B" metalness={0.2} roughness={0.4} />
          </mesh>
          {[
            [0.45, 0.5, 0],
            [-0.45, 0.5, 0],
            [0, 0.5, 0.45],
            [0, 0.5, -0.45]
          ].map((pos, idx) => (
            <mesh key={idx} position={pos}>
              <sphereGeometry args={[0.16, 12, 12]} />
              <meshStandardMaterial color="#F59E0B" metalness={0.1} roughness={0.5} />
            </mesh>
          ))}
          <pointLight position={[0, 1.2, 0]} intensity={6.0} color="#FF9F1C" distance={16} />
          <pointLight position={[0, 0.5, 0]} intensity={3.0} color="#FFD580" distance={10} />
        </group>
      );
    }

    return (
      <mesh>
        <boxGeometry args={[0.8, 1.2, 0.8]} />
        <meshStandardMaterial color="#6E56FF" roughness={0.5} />
      </mesh>
    );
  };

  return (
    <group 
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onSelectLandmark && onSelectLandmark({ type, position, glowColor, name });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
      }}
    >
      {getGeometry()}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.75, 0.82, 32]} />
        <meshBasicMaterial color={glowColor} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

// ─── Volumetric Landmark Spotlights ──────────────────────────────────────────
function LandmarkSpotlight({ position, color, height = 15, radius = 0.8, active }) {
  const beamRef = useRef();

  useFrame(({ clock }) => {
    if (beamRef.current && active) {
      const t = clock.getElapsedTime();
      beamRef.current.rotation.z = Math.sin(t * 0.6) * 0.025;
      beamRef.current.rotation.x = Math.cos(t * 0.5) * 0.025;
    }
  });

  if (!active) return null;

  return (
    <group position={position}>
      <mesh ref={beamRef} position={[0, height / 2, 0]}>
        <cylinderGeometry args={[radius * 1.8, radius * 0.1, height, 16, 1, true]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.10}
          side={THREE.DoubleSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

// ─── Firework Explosion Particle Emitter ─────────────────────────────────────
function FireworkExplosion({ active, position, color }) {
  const pointsRef = useRef();
  const particleCount = 100;
  
  const particles = useMemo(() => {
    const list = [];
    for (let i = 0; i < particleCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      const speed = 0.6 + Math.random() * 1.6;
      list.push({
        vx: Math.sin(phi) * Math.cos(theta) * speed,
        vy: Math.cos(phi) * speed + 1.2, // upward bias
        vz: Math.sin(phi) * Math.sin(theta) * speed,
        x: 0,
        y: 0,
        z: 0,
        life: 1.0,
        decay: 0.015 + Math.random() * 0.015
      });
    }
    return list;
  }, []);

  const positions = useMemo(() => new Float32Array(particleCount * 3), []);

  useFrame(() => {
    if (!active || !pointsRef.current) return;
    const array = pointsRef.current.geometry.attributes.position.array;
    particles.forEach((p, i) => {
      if (p.life > 0) {
        p.x += p.vx * 0.035;
        p.y += p.vy * 0.035;
        p.z += p.vz * 0.035;
        p.vy -= 0.025; // gravity pull
        p.life -= p.decay;
      } else {
        // Reset when life ends
        p.x = 0; p.y = 0; p.z = 0;
        p.life = 0;
      }
      array[i * 3] = p.x;
      array[i * 3 + 1] = p.y;
      array[i * 3 + 2] = p.z;
    });
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (!active) return null;

  return (
    <points ref={pointsRef} position={[position.x, position.y + 1.2, position.z]}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.16} color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Floating Text Overlay Labels ───────────────────────────────────────────
function MapLabel({ text, position, isMajor = false }) {
  const canvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "rgba(10, 15, 30, 0.88)";
    ctx.strokeStyle = isMajor ? "rgba(0, 245, 255, 0.85)" : "rgba(255, 255, 255, 0.22)";
    ctx.lineWidth = 2.5;
    
    const x = 6, y = 6, w = 244, h = 52, r = 8;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = isMajor ? "bold 13px monospace" : "11px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(isMajor ? text : text.toUpperCase(), 128, 32);
    
    return canvas;
  }, [text, isMajor]);

  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  return (
    <sprite position={position} scale={[1.8, 0.45, 1.0]}>
      <spriteMaterial map={texture} depthTest={true} />
    </sprite>
  );
}

// ─── Blue Circle Metro Station Markers ──────────────────────────────────────
function MetroMarker({ position }) {
  const canvas = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#1E40AF";
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = "#FFFFFF";
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(32, 32, 28, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("M", 32, 32);
    
    return canvas;
  }, []);

  const texture = useMemo(() => new THREE.CanvasTexture(canvas), [canvas]);

  return (
    <sprite position={position} scale={[0.42, 0.42, 0.42]}>
      <spriteMaterial map={texture} depthTest={true} />
    </sprite>
  );
}

// ─── Road Network lines (Asphalt visualization) ─────────────────────────────
function RoadLines({ showRoads }) {
  const splines = useMemo(() => {
    const paths = [];
    for (let z = -12; z <= 12; z += 4) {
      paths.push({ start: { x: -14, z }, end: { x: 14, z } });
    }
    for (let x = -14; x <= 14; x += 4) {
      paths.push({ start: { x, z: -12 }, end: { x, z: 12 } });
    }
    paths.push({ start: { x: -8, z: -8 }, end: { x: 8, z: -8 } });
    paths.push({ start: { x: 8, z: -8 }, end: { x: 8, z: 8 } });
    paths.push({ start: { x: 8, z: 8 }, end: { x: -8, z: 8 } });
    paths.push({ start: { x: -8, z: 8 }, end: { x: -8, z: -8 } });
    return paths;
  }, []);

  if (!showRoads) return null;

  return (
    <group>
      {splines.map((road, idx) => {
        const dx = road.end.x - road.start.x;
        const dz = road.end.z - road.start.z;
        const length = Math.sqrt(dx * dx + dz * dz);
        const posX = (road.start.x + road.end.x) / 2;
        const posZ = (road.start.z + road.end.z) / 2;
        const angle = Math.atan2(dx, dz);
        const perpX = -(dz / length) * 0.045;
        const perpZ = (dx / length) * 0.045;

        return (
          <group key={idx}>
            <mesh position={[posX, 0.01, posZ]} rotation={[Math.PI / 2, 0, angle + Math.PI / 2]}>
              <planeGeometry args={[length, 0.18]} />
              <meshBasicMaterial color="#090e18" transparent opacity={0.8} />
            </mesh>
            <mesh position={[posX + perpX, 0.012, posZ + perpZ]} rotation={[Math.PI / 2, 0, angle + Math.PI / 2]}>
              <planeGeometry args={[length, 0.03]} />
              <meshBasicMaterial color="#00F5FF" transparent opacity={0.8} />
            </mesh>
            <mesh position={[posX - perpX, 0.012, posZ - perpZ]} rotation={[Math.PI / 2, 0, angle + Math.PI / 2]}>
              <planeGeometry args={[length, 0.03]} />
              <meshBasicMaterial color="#8B5CF6" transparent opacity={0.7} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// Global cache for procedurally generated building facade textures
const windowTextures = {};
function getWindowTexture(type, stylePreset, isBlackout, customColor) {
  const key = `${type}-${stylePreset}-${isBlackout}-${customColor}`;
  if (windowTextures[key]) return windowTextures[key];

  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");

  let wallColor = "#1E293B";
  const isHologram = stylePreset === "hologram";
  
  if (stylePreset === "clay") {
    wallColor = "#F1F5F9";
  } else if (isHologram) {
    wallColor = "#020617";
  } else if (stylePreset === "night") {
    wallColor = "#020617";
  } else {
    wallColor = type === "commercial" ? "#07091a" : "#0e1220";
  }

  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, 128, 128);

  if (stylePreset !== "clay") {
    const cols = type === "commercial" ? 8 : 4;
    const rows = type === "commercial" ? 12 : 6;
    const cellW = 128 / cols;
    const cellH = 128 / rows;
    const winW = cellW * 0.7;
    const winH = cellH * 0.6;
    const paddingX = (cellW - winW) / 2;
    const paddingY = (cellH - winH) / 2;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        let isLit = false;
        if (!isBlackout) {
          isLit = isHologram ? true : Math.random() > 0.35;
        }

        if (isLit) {
          if (isHologram) {
            ctx.fillStyle = customColor || "#00F5FF";
          } else {
            const rand = Math.random();
            ctx.fillStyle = customColor ? customColor : (rand > 0.75 ? "#FFFFFF" : "#FFC857");
          }
        } else {
          ctx.fillStyle = isHologram ? "rgba(0, 245, 255, 0.08)" : "#090D1A";
        }
        ctx.fillRect(c * cellW + paddingX, r * cellH + paddingY, winW, winH);

        if (!isHologram) {
          ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
          ctx.lineWidth = 1;
          ctx.strokeRect(c * cellW, r * cellH, cellW, cellH);
        }
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  windowTextures[key] = texture;
  return texture;
}

// ─── Blinking Emergency Warning Red Beacon ──────────────────────────────────
function BlinkingLight({ position }) {
  const lightRef = useRef();
  useFrame(({ clock }) => {
    if (lightRef.current) {
      const flash = Math.floor(clock.getElapsedTime() * 3.5) % 2 === 0;
      lightRef.current.visible = flash;
    }
  });

  return (
    <group position={position}>
      <mesh ref={lightRef}>
        <sphereGeometry args={[0.045, 8, 8]} />
        <meshBasicMaterial color="#EF4444" />
      </mesh>
    </group>
  );
}

// ─── Procedural Building Model with Premium Details ──────────────────────────
function ProceduralBuilding({ b, stylePreset, isSelected, isBuildingBlackedOut, onSelectBld, weather }) {
  const [isHovered, setIsHovered] = useState(false);
  const districtColor = b.districtObj?.color || "#00F5FF";

  const texture = useMemo(() => {
    if (stylePreset === "clay") return null;
    const baseTex = getWindowTexture(b.type, stylePreset, isBuildingBlackedOut, districtColor);
    const cloned = baseTex.clone();
    
    const scaleX = b.type === "commercial" ? 6 : 4;
    const scaleY = b.type === "commercial" ? 9 : 5;
    const repX = Math.max(1, Math.round(b.w * scaleX));
    const repY = Math.max(1, Math.round(b.h * scaleY));
    cloned.repeat.set(repX, repY);
    cloned.needsUpdate = true;
    return cloned;
  }, [b.type, stylePreset, isBuildingBlackedOut, b.w, b.h, districtColor]);

  let bldColor = districtColor;
  let emissiveIntensity = 0.25;
  let wireframe = false;
  let transparent = false;

  if (stylePreset === "hologram") {
    bldColor = isSelected ? "#FF2E88" : districtColor;
    wireframe = true;
    transparent = true;
    emissiveIntensity = 0.65;
  } else if (stylePreset === "clay") {
    bldColor = "#FBBF24";
    emissiveIntensity = 0;
  } else if (stylePreset === "night") {
    bldColor = isBuildingBlackedOut ? "#1E293B" : isSelected ? "#FF2E88" : "#0F172A";
    emissiveIntensity = isBuildingBlackedOut ? 0.02 : 1.3;
  } else {
    bldColor = isBuildingBlackedOut ? "#334155" : isSelected ? "#FF2E88" : "#475569";
    emissiveIntensity = isBuildingBlackedOut ? 0.03 : 0.55;
  }

  // Boost emissive glow when hovered
  if (isHovered && stylePreset !== "clay") {
    emissiveIntensity = Math.min(2.5, emissiveIntensity * 2.2 + 0.6);
  }

  const isCommercial = b.type === "commercial";
  const isTall = b.h > 1.4;
  const isCylinder = isCommercial && isTall && (Math.floor(b.x * 10) + Math.floor(b.z * 10)) % 2 === 0;
  const hasSpire = isCommercial && isTall;
  const spireHeight = b.h * 0.22;
  const hasGlassCladding = stylePreset !== "clay";

  return (
    <group
      position={[b.x, isHovered ? 0.12 : 0, b.z]}
      scale={isHovered ? [1.06, 1.06, 1.06] : [1, 1, 1]}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBld(b);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setIsHovered(true);
        const tooltip = document.getElementById("city-hud-tooltip");
        if (tooltip) {
          const col = b.districtObj?.color || "#00F5FF";
          tooltip.style.borderColor = col;
          tooltip.style.boxShadow = `0 12px 30px rgba(0,0,0,0.65), 0 0 20px ${col}44`;
          tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 7px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${col}; box-shadow: 0 0 6px ${col}; display: inline-block;"></span>
              <span style="font-weight: bold; color: #FFFFFF; font-size: 11px;">${b.districtObj?.name || 'Smart Node'}</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div>NODE ID: <span style="color: #00F5FF;">${b.id.substring(0, 14)}</span></div>
              <div>SECTOR: <span style="color: #E0F2FE; text-transform: capitalize;">${b.type}</span></div>
              <div>HEIGHT: <span style="color: #E0F2FE;">${b.h.toFixed(2)}m</span></div>
              <div>OCCUPANCY: <span style="color: #E0F2FE;">${b.occupancy} PAX</span></div>
              <div>EFFICIENCY: <span style="color: #34D399;">${b.energyEfficiency}%</span></div>
            </div>
          `;
          tooltip.style.display = "block";
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setIsHovered(false);
        const tooltip = document.getElementById("city-hud-tooltip");
        if (tooltip) {
          tooltip.style.display = "none";
        }
      }}
    >
      {/* 1. CLAY PRESET MODE */}
      {stylePreset === "clay" && (
        <mesh position={[0, b.h / 2, 0]} castShadow receiveShadow>
          {isCylinder ? (
            <cylinderGeometry args={[b.w / 2, b.w / 2, b.h, 16]} />
          ) : (
            <boxGeometry args={[b.w, b.h, b.d]} />
          )}
          <meshStandardMaterial color={isSelected ? "#FF2E88" : "#E2E8F0"} roughness={0.7} metalness={0.1} />
        </mesh>
      )}

      {/* 2. PREMIUM MULTI-LAYER MODELLING */}
      {stylePreset !== "clay" && (
        <>
          {/* A. INNER TEXTURED CORE */}
          <mesh position={[0, (b.h - 0.01) / 2, 0]} castShadow receiveShadow>
            {isCylinder ? (
              <cylinderGeometry args={[b.w / 2 * 0.92, b.w / 2 * 0.92, b.h - 0.01, 16]} />
            ) : (
              <boxGeometry args={[b.w * 0.92, b.h - 0.01, b.d * 0.92]} />
            )}
            <meshStandardMaterial
              color={stylePreset === "hologram" ? bldColor : "#1E293B"}
              map={texture}
              emissiveMap={texture}
              roughness={0.4}
              metalness={0.3}
              transparent={stylePreset === "hologram"}
              opacity={stylePreset === "hologram" ? 0.45 : 1.0}
              wireframe={wireframe}
              emissive={isBuildingBlackedOut ? "#000000" : districtColor}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>

          {/* B. OUTER REFLECTIVE GLASS ENVELOPE */}
          {hasGlassCladding && (
            <mesh position={[0, b.h / 2, 0]}>
              {isCylinder ? (
                <cylinderGeometry args={[b.w / 2, b.w / 2, b.h, 16]} />
              ) : (
                <boxGeometry args={[b.w, b.h, b.d]} />
              )}
              <meshStandardMaterial
                color={stylePreset === "hologram" ? bldColor : (stylePreset === "night" ? "#0F172A" : "#0d111d")}
                roughness={0.05}
                metalness={0.95}
                transparent
                opacity={stylePreset === "hologram" ? 0.3 : 0.38}
                wireframe={wireframe}
              />
            </mesh>
          )}

          {/* C. LOBBY COLUMN BASE */}
          {b.h > 1.0 && (
            <group>
              <mesh position={[0, 0.08, 0]} castShadow>
                <boxGeometry args={[b.w * 0.85, 0.16, b.d * 0.85]} />
                <meshStandardMaterial
                  color={stylePreset === "hologram" ? bldColor : "#090D1A"}
                  roughness={0.1}
                  metalness={0.9}
                  transparent={transparent}
                  opacity={stylePreset === "hologram" ? 0.45 : 0.85}
                />
              </mesh>
              {[-b.w / 2 + 0.02, b.w / 2 - 0.02].flatMap(offsetX => 
                [-b.d / 2 + 0.02, b.d / 2 - 0.02].map((offsetZ, idx) => (
                  <mesh key={`${offsetX}-${offsetZ}-${idx}`} position={[offsetX, 0.08, offsetZ]} castShadow>
                    <boxGeometry args={[0.03, 0.16, 0.03]} />
                    <meshStandardMaterial
                      color={stylePreset === "hologram" ? bldColor : districtColor}
                      roughness={0.3}
                      metalness={0.9}
                      transparent={transparent}
                      opacity={stylePreset === "hologram" ? 0.6 : 1.0}
                    />
                  </mesh>
                ))
              )}
            </group>
          )}

          {/* D. BALCONIES */}
          {!isCommercial && b.h >= 1.3 && (
            <group>
              {Array.from({ length: Math.min(4, Math.floor(b.h / 0.35)) }).map((_, i) => {
                const ledgeY = (i + 1) * 0.35;
                if (ledgeY < b.h) {
                  return (
                    <group key={i}>
                      <mesh position={[0, ledgeY, 0]} castShadow>
                        <boxGeometry args={[b.w * 1.08, 0.02, b.d * 1.08]} />
                        <meshStandardMaterial
                          color={stylePreset === "hologram" ? bldColor : "#475569"}
                          roughness={0.6}
                          metalness={0.3}
                          transparent={transparent}
                          opacity={stylePreset === "hologram" ? 0.4 : 1.0}
                        />
                      </mesh>
                    </group>
                  );
                }
                return null;
              })}
            </group>
          )}

          {/* E. MECHANICAL DECK */}
          {b.h > 0.8 && (
            <group>
              <mesh position={[0, b.h + 0.04, 0]} castShadow>
                <boxGeometry args={[b.w * 0.78, 0.08, b.d * 0.78]} />
                <meshStandardMaterial
                  color={stylePreset === "hologram" ? bldColor : "#334155"}
                  roughness={0.5}
                  metalness={0.5}
                  transparent={transparent}
                  opacity={stylePreset === "hologram" ? 0.55 : 1.0}
                />
              </mesh>
            </group>
          )}

          {/* F. TALL SPIRE */}
          {hasSpire && (
            <group position={[0, b.h + 0.08, 0]}>
              <mesh castShadow position={[0, 0.01, 0]}>
                <cylinderGeometry args={[0.03, 0.036, 0.02, 8]} />
                <meshStandardMaterial color={districtColor} roughness={0.3} metalness={0.9} />
              </mesh>
              <mesh castShadow position={[0, spireHeight / 2 + 0.02, 0]}>
                <cylinderGeometry args={[0.008, 0.016, spireHeight, 8]} />
                <meshStandardMaterial
                  color={districtColor}
                  roughness={0.3}
                  metalness={0.9}
                  transparent={transparent}
                  opacity={stylePreset === "hologram" ? 0.65 : 1.0}
                />
              </mesh>
              <BlinkingLight position={[0, spireHeight + 0.02, 0]} />
            </group>
          )}

          {/* G. SOLAR PANEL UPGRADE */}
          {b.hasSolar && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.09 : 0.01), 0]} rotation={[0.2, 0, 0]}>
              <mesh castShadow>
                <boxGeometry args={[b.w * 0.75, 0.02, b.d * 0.75]} />
                <meshStandardMaterial color="#1e3a8a" emissive="#3b82f6" emissiveIntensity={0.8} roughness={0.15} metalness={0.9} />
              </mesh>
              <mesh position={[0, -0.04, 0]}>
                <cylinderGeometry args={[0.02, 0.02, 0.08, 4]} />
                <meshStandardMaterial color="#475569" roughness={0.5} />
              </mesh>
            </group>
          )}

          {/* H. SKY GARDEN UPGRADE */}
          {b.hasGarden && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.09 : 0.01), 0]}>
              <mesh castShadow>
                <boxGeometry args={[b.w * 0.82, 0.02, b.d * 0.82]} />
                <meshStandardMaterial color="#15803d" roughness={0.9} />
              </mesh>
              {[-b.w*0.25, b.w*0.25].flatMap(ox =>
                [-b.d*0.25, b.d*0.25].map((oz, idx) => (
                  <mesh key={idx} position={[ox, 0.04, oz]}>
                    <sphereGeometry args={[0.04, 5, 4]} />
                    <meshStandardMaterial color="#166534" roughness={0.9} />
                  </mesh>
                ))
              )}
            </group>
          )}

          {/* I. TAPERED TOWER EXTRA TIER */}
          {b.roofStyle === "tapered" && (
            <mesh position={[0, b.h + (b.h * 0.2) / 2, 0]} castShadow>
              <boxGeometry args={[b.w * 0.72, b.h * 0.2, b.d * 0.72]} />
              <meshStandardMaterial
                color={stylePreset === "hologram" ? bldColor : "#1E293B"}
                map={texture}
                emissiveMap={texture}
                roughness={0.4}
                metalness={0.3}
                transparent={stylePreset === "hologram"}
                opacity={stylePreset === "hologram" ? 0.45 : 1.0}
                wireframe={wireframe}
                emissive={isBuildingBlackedOut ? "#000000" : districtColor}
                emissiveIntensity={emissiveIntensity}
              />
            </mesh>
          )}

          {/* J. HELIPAD UPGRADE */}
          {b.roofStyle === "helipad" && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.09 : 0.01), 0]}>
              <mesh castShadow>
                <cylinderGeometry args={[b.w * 0.38, b.w * 0.42, 0.04, 16]} />
                <meshStandardMaterial map={getHelipadTexture(districtColor)} roughness={0.6} />
              </mesh>
              {[[0.32, 0.32], [-0.32, 0.32], [0.32, -0.32], [-0.32, -0.32]].map((pos, idx) => (
                <BlinkingLight key={idx} position={[pos[0] * b.w, 0.03, pos[1] * b.d]} />
              ))}
            </group>
          )}

          {/* K. WATER TOWER */}
          {b.roofStyle === "watertower" && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.09 : 0.01) + 0.05, 0]}>
              {[[0.12, 0.12], [-0.12, 0.12], [0.12, -0.12], [-0.12, -0.12]].map((pos, idx) => (
                <mesh key={idx} position={[pos[0] * b.w, -0.05, pos[1] * b.d]}>
                  <cylinderGeometry args={[0.008, 0.008, 0.1, 4]} />
                  <meshStandardMaterial color="#475569" roughness={0.5} />
                </mesh>
              ))}
              <mesh position={[0, 0.08, 0]} castShadow>
                <cylinderGeometry args={[0.12, 0.12, 0.18, 12]} />
                <meshStandardMaterial color="#78350F" roughness={0.9} />
              </mesh>
              <mesh position={[0, 0.20, 0]} castShadow>
                <coneGeometry args={[0.14, 0.08, 12]} />
                <meshStandardMaterial color="#451a03" roughness={0.8} />
              </mesh>
            </group>
          )}

          {/* L. ANTENNA MAST */}
          {b.roofStyle === "antenna" && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.081 : 0.0), 0]}>
              <mesh position={[0, 0.25, 0]} castShadow>
                <cylinderGeometry args={[0.005, 0.015, 0.5, 6]} />
                <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.9} />
              </mesh>
              <BlinkingLight position={[0, 0.5, 0]} />
            </group>
          )}

          {/* M. HVAC UNITS */}
          {b.roofStyle === "hvac" && (
            <group position={[0, b.h + (b.h > 0.8 ? 0.081 : 0.0), 0]}>
              <mesh position={[-0.08 * b.w, 0.03, 0]} castShadow>
                <boxGeometry args={[b.w * 0.28, 0.06, b.d * 0.28]} />
                <meshStandardMaterial color="#64748B" roughness={0.4} metalness={0.7} />
              </mesh>
              <mesh position={[0.08 * b.w, 0.02, 0.05 * b.d]} castShadow>
                <boxGeometry args={[b.w * 0.2, 0.04, b.d * 0.2]} />
                <meshStandardMaterial color="#475569" roughness={0.4} metalness={0.7} />
              </mesh>
            </group>
          )}

          {/* N. SNOW ACCUMULATION ACCURATE OVERLAY */}
          {weather === "snow" && stylePreset !== "hologram" && stylePreset !== "clay" && (
            <mesh position={[0, b.h + (b.h > 0.8 ? 0.081 : 0.005) + (b.roofStyle === "watertower" ? 0.05 : 0.0), 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[b.w * (b.h > 0.8 ? 0.76 : 0.90), b.d * (b.h > 0.8 ? 0.76 : 0.90)]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.9} metalness={0.0} />
            </mesh>
          )}
        </>
      )}

      {/* Selected Neon Ring Outline */}
      {isSelected && (
        <mesh position={[0, b.h / 2, 0]}>
          {isCylinder ? (
            <cylinderGeometry args={[b.w / 2 + 0.06, b.w / 2 + 0.06, b.h + 0.04, 16, 1, true]} />
          ) : (
            <boxGeometry args={[b.w + 0.08, b.h + 0.04, b.d + 0.08]} />
          )}
          <meshBasicMaterial color="#FF2E88" wireframe side={THREE.DoubleSide} transparent opacity={0.65} />
        </mesh>
      )}
    </group>
  );
}

// ─── Weather Effects: Cloud Layer, Rain & Snow Particles ──────────────────────
function WeatherEffects({ type, lightningActive }) {
  const rainRef = useRef();
  const snowRef = useRef();
  const cloudsRef = useRef();
  
  const rainCount = 450;
  const snowCount = 200;
  
  const rainData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < rainCount; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 32,
        y: Math.random() * 12 + 2,
        z: (Math.random() - 0.5) * 32,
        speed: 0.15 + Math.random() * 0.15,
      });
    }
    return arr;
  }, []);

  const snowData = useMemo(() => {
    const arr = [];
    for (let i = 0; i < snowCount; i++) {
      arr.push({
        x: (Math.random() - 0.5) * 32,
        y: Math.random() * 12 + 2,
        z: (Math.random() - 0.5) * 32,
        speed: 0.03 + Math.random() * 0.03,
        swaySpeed: 1 + Math.random() * 2,
        swayOffset: Math.random() * 10
      });
    }
    return arr;
  }, []);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    
    if (type === "rain" && rainRef.current) {
      const positions = rainRef.current.geometry.attributes.position.array;
      for (let i = 0; i < rainCount; i++) {
        const idx = i * 3 + 1;
        positions[idx] -= rainData[i].speed;
        if (positions[idx] < 0) {
          positions[idx] = Math.random() * 12 + 2;
        }
      }
      rainRef.current.geometry.attributes.position.needsUpdate = true;
    }
    
    if (type === "snow" && snowRef.current) {
      const positions = snowRef.current.geometry.attributes.position.array;
      for (let i = 0; i < snowCount; i++) {
        const idx = i * 3 + 1;
        const idxX = i * 3;
        positions[idx] -= snowData[i].speed;
        positions[idxX] += Math.sin(time * snowData[i].swaySpeed + snowData[i].swayOffset) * 0.008;
        if (positions[idx] < 0) {
          positions[idx] = Math.random() * 12 + 2;
        }
      }
      snowRef.current.geometry.attributes.position.needsUpdate = true;
    }
    
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0008;
    }
  });

  const positionsArr = useMemo(() => {
    const arr = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      arr[i * 3] = rainData[i].x;
      arr[i * 3 + 1] = rainData[i].y;
      arr[i * 3 + 2] = rainData[i].z;
    }
    return arr;
  }, [rainData]);

  const snowPositionsArr = useMemo(() => {
    const arr = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      arr[i * 3] = snowData[i].x;
      arr[i * 3 + 1] = snowData[i].y;
      arr[i * 3 + 2] = snowData[i].z;
    }
    return arr;
  }, [snowData]);

  return (
    <group>
      {(type === "rain" || type === "snow" || type === "hologram" || lightningActive) && (
        <group ref={cloudsRef}>
          {[...Array(6)].map((_, i) => (
            <mesh key={i} position={[(i - 3) * 6, 8, (Math.sin(i) * 3)]} rotation={[0.1, 0.4 * i, 0.1]}>
              <boxGeometry args={[4.5, 0.5, 3]} />
              <meshStandardMaterial color={type === "hologram" ? "#00F5FF" : "#94A3B8"} transparent opacity={0.16} />
            </mesh>
          ))}
        </group>
      )}

      {type === "rain" && (
        <points ref={rainRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={rainCount}
              array={positionsArr}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.065} color="#7DD3FC" transparent opacity={0.65} />
        </points>
      )}

      {type === "snow" && (
        <points ref={snowRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={snowCount}
              array={snowPositionsArr}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.09} color="#FFFFFF" transparent opacity={0.8} />
        </points>
      )}
    </group>
  );
}

// ─── Flying Drones Component ────────────────────────────────────────────────
function FlyingDrones() {
  const dronesRef = useRef();
  const count = 12;

  const droneData = useMemo(() => {
    const list = [];
    for (let i = 0; i < count; i++) {
      list.push({
        angle: Math.random() * Math.PI * 2,
        radius: 4.5 + Math.random() * 8,
        height: 1.8 + Math.random() * 2.2,
        speed: 0.008 + Math.random() * 0.012,
        wobbleSpeed: 2 + Math.random() * 3,
        id: i
      });
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    if (dronesRef.current) {
      const time = clock.getElapsedTime();
      droneData.forEach((drone, idx) => {
        drone.angle += drone.speed;
        const x = Math.cos(drone.angle) * drone.radius;
        const z = Math.sin(drone.angle) * drone.radius;
        const y = drone.height + Math.sin(time * drone.wobbleSpeed) * 0.12;
        
        const mesh = dronesRef.current.children[idx];
        if (mesh) {
          mesh.position.set(x, y, z);
          mesh.rotation.y = -drone.angle + Math.PI / 2;
        }
      });
    }
  });

  return (
    <group ref={dronesRef}>
      {droneData.map((drone) => (
        <group key={drone.id}>
          {/* Main Body */}
          <mesh castShadow>
            <boxGeometry args={[0.2, 0.06, 0.2]} />
            <meshStandardMaterial color="#00F5FF" metalness={0.9} roughness={0.1} emissive="#00F5FF" emissiveIntensity={0.5} />
          </mesh>
          {/* Rotors */}
          <mesh position={[0, 0.04, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.01, 4]} />
            <meshBasicMaterial color="#EC4899" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Holographic AI Assistant Model ──────────────────────────────────────────
function HolographicAssistantModel({ selectedBld, stylePreset }) {
  const groupRef = useRef();
  const coneRef = useRef();
  const [position, setPosition] = useState(new THREE.Vector3(0, 5, 0));

  useEffect(() => {
    if (selectedBld) {
      setPosition(new THREE.Vector3(selectedBld.x, selectedBld.h + 0.8, selectedBld.z));
    }
  }, [selectedBld]);

  useFrame(({ clock }) => {
    if (groupRef.current && selectedBld) {
      const targetVec = new THREE.Vector3(selectedBld.x, selectedBld.h + 0.8, selectedBld.z);
      groupRef.current.position.lerp(targetVec, 0.08);
      groupRef.current.position.y += Math.sin(clock.getElapsedTime() * 4.0) * 0.015;
      groupRef.current.rotation.y = clock.getElapsedTime() * 1.5;
      
      if (coneRef.current) {
        coneRef.current.rotation.y = -clock.getElapsedTime() * 0.8;
      }
    }
  });

  if (!selectedBld) return null;

  const accentColor = stylePreset === "hologram" ? "#00F5FF" : "#FF2E88";

  return (
    <group ref={groupRef} position={[position.x, position.y, position.z]}>
      {/* Floating Octahedron Core */}
      <mesh>
        <octahedronGeometry args={[0.15]} />
        <meshStandardMaterial color={accentColor} emissive={accentColor} emissiveIntensity={2.0} roughness={0.1} />
      </mesh>
      {/* Outer spinning ring */}
      <mesh rotation={[Math.PI / 4, 0, 0]}>
        <torusGeometry args={[0.26, 0.015, 6, 24]} />
        <meshBasicMaterial color={accentColor} transparent opacity={0.8} />
      </mesh>
      {/* Holographic scanner cone projecting down onto building */}
      <group position={[0, -0.4, 0]} ref={coneRef}>
        <mesh rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.42, 0.8, 16, 1, true]} />
          <meshBasicMaterial color={accentColor} transparent opacity={0.22} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  );
}

// ─── Traffic Flows ───────────────────────────────────────────────────────────
// ─── Traffic Flows & Intersection Controls ──────────────────────────────────
const INTERSECTIONS = [
  { x: -6, z: -4 },
  { x: -2, z: 4 },
  { x: 2, z: -8 },
  { x: 6, z: 0 },
  { x: -6, z: 8 },
  { x: 6, z: 8 },
  { x: -2, z: -4 },
  { x: 2, z: 4 }
];

const getTrafficLightState = (x, z, time) => {
  const offset = (Math.abs(x) + Math.abs(z)) % 2 === 0 ? 0 : 4.5;
  const cycleTime = (time + offset) % 9;
  if (cycleTime < 4.0) return "green";
  if (cycleTime < 5.0) return "yellow";
  return "red";
};

function TrafficLight({ position, overriddenLights, onToggleLight }) {
  const greenMesh = useRef();
  const yellowMesh = useRef();
  const redMesh = useRef();

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const key = `${position[0]},${position[2]}`;
    const state = overriddenLights?.[key] || getTrafficLightState(position[0], position[2], time);
    if (greenMesh.current && yellowMesh.current && redMesh.current) {
      greenMesh.current.material.emissiveIntensity = state === "green" ? 3.0 : 0.05;
      greenMesh.current.material.color.set(state === "green" ? "#22c55e" : "#14532d");
      yellowMesh.current.material.emissiveIntensity = state === "yellow" ? 3.0 : 0.05;
      yellowMesh.current.material.color.set(state === "yellow" ? "#eab308" : "#713f12");
      redMesh.current.material.emissiveIntensity = state === "red" ? 3.0 : 0.05;
      redMesh.current.material.color.set(state === "red" ? "#ef4444" : "#7f1d1d");
    }
  });

  return (
    <group
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onToggleLight && onToggleLight(position[0], position[2]);
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        document.body.style.cursor = "auto";
      }}
    >
      {/* Pole */}
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.015, 0.018, 0.7, 6]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* Head */}
      <mesh position={[0, 0.72, 0]}>
        <boxGeometry args={[0.06, 0.20, 0.06]} />
        <meshStandardMaterial color="#090d16" roughness={0.4} />
      </mesh>
      {/* Red Bulb */}
      <mesh ref={redMesh} position={[0, 0.79, 0.032]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.1} />
      </mesh>
      {/* Yellow Bulb */}
      <mesh ref={yellowMesh} position={[0, 0.72, 0.032]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#eab308" emissive="#eab308" emissiveIntensity={0.1} />
      </mesh>
      {/* Green Bulb */}
      <mesh ref={greenMesh} position={[0, 0.65, 0.032]}>
        <sphereGeometry args={[0.02, 6, 6]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.1} />
      </mesh>
    </group>
  );
}

function Vehicle({ data, splines, congestionMode, onSelectVehicle, isSelected, overriddenLights, computePriorities }) {
  const meshRef = useRef();
  const [progress, setProgress] = useState(data.progress);
  const [currentSpeedKmh, setCurrentSpeedKmh] = useState(45);
  const [isStopped, setIsStopped] = useState(false);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    const spline = splines[data.splineIdx % splines.length];
    if (!spline) return;

    // Calculate current position
    const posX = spline.start.x + (spline.end.x - spline.start.x) * progress;
    const posZ = spline.start.z + (spline.end.z - spline.start.z) * progress;

    // Check traffic lights
    let shouldStop = false;
    INTERSECTIONS.forEach(light => {
      const dist = Math.sqrt((posX - light.x)**2 + (posZ - light.z)**2);
      if (dist < 0.6) {
        const key = `${light.x},${light.z}`;
        const state = overriddenLights?.[key] || getTrafficLightState(light.x, light.z, time);
        if (state === "red" || state === "yellow") {
          shouldStop = true;
        }
      }
    });

    const transitPriority = computePriorities?.transit ?? 33;
    const speedModifier = (congestionMode ? 0.35 : 1.0) * (0.5 + transitPriority / 66);
    const actualSpeed = shouldStop ? 0 : data.speed * speedModifier;
    
    setIsStopped(shouldStop);
    setCurrentSpeedKmh(shouldStop ? 0 : Math.round(data.speed * 18000 * speedModifier));

    const nextProgress = progress + actualSpeed;
    setProgress(nextProgress > 1 ? 0 : nextProgress);

    if (meshRef.current) {
      meshRef.current.position.set(posX, 0.06, posZ);
      const dx = spline.end.x - spline.start.x;
      const dz = spline.end.z - spline.start.z;
      const angle = Math.atan2(dx, dz);
      meshRef.current.rotation.y = angle;
    }
  });

  const spline = splines[data.splineIdx % splines.length];
  const routeName = spline ? `Spline #${data.splineIdx} Route` : "City Link";

  return (
    <group
      ref={meshRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelectVehicle({
          id: `TRANSIT-POD-${data.id + 10}A`,
          speed: currentSpeedKmh,
          isStopped: isStopped,
          battery: data.battery,
          occupancy: data.occupancy,
          cargo: data.cargo,
          route: routeName
        });
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        const tooltip = document.getElementById("city-hud-tooltip");
        if (tooltip) {
          tooltip.style.borderColor = "#F59E0B";
          tooltip.style.boxShadow = `0 12px 30px rgba(0,0,0,0.65), 0 0 20px rgba(245,158,11,0.22)`;
          tooltip.innerHTML = `
            <div style="display: flex; align-items: center; gap: 7px; margin-bottom: 7px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; box-shadow: 0 0 6px #F59E0B; display: inline-block;"></span>
              <span style="font-weight: bold; color: #FFFFFF; font-size: 11px;">Autonomous Transit Pod</span>
            </div>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <div>ID: <span style="color: #F59E0B;">TRANSIT-POD-${data.id + 10}A</span></div>
              <div>SPEED: <span style="color: #E0F2FE;">${currentSpeedKmh} km/h</span></div>
              <div>STATUS: <span style="color: ${isStopped ? '#EF4444' : '#10B981'}">${isStopped ? "STOPPED AT SIGNAL" : "CRUISING"}</span></div>
              <div>BATTERY: <span style="color: #34D399;">${data.battery}%</span></div>
            </div>
          `;
          tooltip.style.display = "block";
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        const tooltip = document.getElementById("city-hud-tooltip");
        if (tooltip) tooltip.style.display = "none";
      }}
    >
      {/* Futuristic Hover Pod Body */}
      <mesh castShadow>
        <boxGeometry args={[0.13, 0.07, 0.25]} />
        <meshStandardMaterial
          color={isSelected ? "#FF2E88" : (hovered ? "#F59E0B" : "#00F5FF")}
          roughness={0.1}
          metalness={0.9}
          emissive={isSelected ? "#FF2E88" : (hovered ? "#F59E0B" : "#00F5FF")}
          emissiveIntensity={hovered || isSelected ? 0.8 : 0.3}
        />
      </mesh>
      {/* Pod Cockpit glass */}
      <mesh position={[0, 0.05, 0.02]}>
        <boxGeometry args={[0.09, 0.04, 0.12]} />
        <meshStandardMaterial color="#020617" roughness={0.05} metalness={0.95} />
      </mesh>
      {/* Front Headlights */}
      <mesh position={[-0.04, 0, 0.128]}>
        <boxGeometry args={[0.02, 0.015, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[0.04, 0, 0.128]}>
        <boxGeometry args={[0.02, 0.015, 0.01]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      {/* Rear Taillights */}
      <mesh position={[-0.04, 0, -0.128]}>
        <boxGeometry args={[0.02, 0.015, 0.01]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[0.04, 0, -0.128]}>
        <boxGeometry args={[0.02, 0.015, 0.01]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
}

function TrafficFlow({ roads = [], congestionMode = false, onSelectVehicle, selectedVehicle, overriddenLights, computePriorities }) {
  const splines = useMemo(() => {
    if (roads.length > 0) {
      const paths = [];
      for (let i = 0; i < roads.length; i += 2) {
        if (roads[i + 1]) {
          paths.push({ start: roads[i], end: roads[i + 1] });
        }
      }
      return paths;
    }
    const paths = [];
    for (let z = -12; z <= 12; z += 4) {
      paths.push({ start: { x: -14, z }, end: { x: 14, z } });
    }
    for (let x = -14; x <= 14; x += 4) {
      paths.push({ start: { x, z: -12 }, end: { x, z: 12 } });
    }
    paths.push({ start: { x: -8, z: -8 }, end: { x: 8, z: -8 } });
    paths.push({ start: { x: 8, z: -8 }, end: { x: 8, z: 8 } });
    paths.push({ start: { x: 8, z: 8 }, end: { x: -8, z: 8 } });
    paths.push({ start: { x: -8, z: 8 }, end: { x: -8, z: -8 } });
    return paths;
  }, [roads]);

  const vehicleCount = Math.min(24, Math.max(12, splines.length * 2));
  const vehicleData = useMemo(() => {
    const list = [];
    const cargoTypes = ["Quantum CPU Parts", "Medical Serum Pack", "Fresh Groceries", "Bio-fuel canister", "System Core Sensor"];
    for (let i = 0; i < vehicleCount; i++) {
      list.push({
        id: i,
        splineIdx: i,
        progress: Math.random(),
        speed: 0.0018 + Math.random() * 0.0022,
        battery: Math.floor(Math.random() * 40) + 60,
        occupancy: Math.floor(Math.random() * 4) + 1,
        cargo: cargoTypes[i % cargoTypes.length]
      });
    }
    return list;
  }, [vehicleCount]);

  if (splines.length === 0) return null;

  return (
    <group>
      {vehicleData.map((v) => (
        <Vehicle
          key={v.id}
          data={v}
          splines={splines}
          congestionMode={congestionMode}
          onSelectVehicle={onSelectVehicle}
          isSelected={selectedVehicle?.id === `TRANSIT-POD-${v.id + 10}A`}
          overriddenLights={overriddenLights}
          computePriorities={computePriorities}
        />
      ))}
    </group>
  );
}

// ─── Emergency Siren Animation ────────────────────────────────────────────────
function SirenParticle({ sirenActive, targetPos }) {
  const meshRef = useRef();
  const [position, setPosition] = useState({ x: -10, y: 0.1, z: -10 });
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (sirenActive && targetPos) {
      setPosition({ x: -13, y: 0.15, z: -11 });
    }
  }, [sirenActive, targetPos]);

  useFrame(({ clock }) => {
    if (sirenActive && targetPos && meshRef.current) {
      const t = clock.getElapsedTime();
      setPhase(Math.floor(t * 12) % 2);

      const currentVec = new THREE.Vector3(position.x, 0.15, position.z);
      const targetVec = new THREE.Vector3(targetPos.x, 0.15, targetPos.z);
      currentVec.lerp(targetVec, 0.015);
      setPosition({ x: currentVec.x, y: 0.15, z: currentVec.z });
    }
  });

  if (!sirenActive) return null;

  const sirenColor = phase === 0 ? "#ef4444" : "#00f5ff";

  return (
    <group position={[position.x, position.y, position.z]} ref={meshRef}>
      <mesh>
        <sphereGeometry args={[0.26, 8, 8]} />
        <meshBasicMaterial color={sirenColor} />
      </mesh>
      <pointLight intensity={2.5} color={sirenColor} distance={4} />
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 12]} />
        <meshBasicMaterial color={sirenColor} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

// ─── Blackout Grid Ripple Effect ──────────────────────────────────────────────
function BlackoutWave({ active, origin, radius }) {
  if (!active || !origin) return null;
  return (
    <mesh position={[origin.x, 0.05, origin.z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[Math.max(0.1, radius - 0.15), radius + 0.15, 64]} />
      <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} transparent opacity={Math.max(0, 0.8 - radius / 22)} />
    </mesh>
  );
}

// ─── Dense Procedural Tree Clusters ──────────────────────────────────────────
function DenseTreeClusters() {
  const trees = useMemo(() => {
    const zones = [
      [-1.8,-1.2],[ 1.2, 0.6],[-3.0, 2.2],[ 2.6,-1.8],[0.2, 3.1],[-2.2, 0.4],[1.8, 2.5],
      [-5.0,-8.2],[-2.6,-9.0],[1.0,-8.8],[-7.2,-5.2],[-3.8,-7.0],[0,-9.5],[3.5,-8.5],
      [-1.2, 5.2],[1.6, 6.8],[-2.8, 7.2],[3.6, 5.8],[0.6, 8.2],[-4.0, 5.0],[2.0, 4.0],
      [5.2, 2.2],[6.2,-1.2],[5.8, 5.2],[7.2,-3.2],[6.5, 7.0],
      [-6.2, 2.2],[-7.8,-2.2],[-8.2, 4.2],[-5.8, 6.2],[-9.0, 0.0],[-6.5,-0.5],
      [-8.2,-8.2],[8.2,-8.2],[8.2, 8.2],[-8.2, 8.2],
      [-4.2,-10.0],[4.2,-10.0],[10.0, 4.0],[10.0,-4.0],[-10.0, 3.0],[-10.0,-3.0],
    ];
    const result = [];
    zones.forEach(([bx, bz], zi) => {
      const count = 4 + (zi % 4);
      for (let t = 0; t < count; t++) {
        const angle = (t / count) * Math.PI * 2 + zi * 0.65;
        const r = 0.18 + ((t * 0.22 + zi * 0.09) % 0.85);
        const size = 0.12 + ((t * 0.08 + zi * 0.04) % 0.24);
        const colorIdx = (zi + t) % 4;
        result.push({
          x: bx + Math.cos(angle) * r,
          z: bz + Math.sin(angle) * r,
          size,
          color: colorIdx === 0 ? "#064e3b" : colorIdx === 1 ? "#065f46" : colorIdx === 2 ? "#047857" : "#059669"
        });
      }
    });
    return result;
  }, []);

  return (
    <group>
      {trees.map((pt, i) => (
        <mesh key={i} position={[pt.x, pt.size * 0.52, pt.z]}>
          <sphereGeometry args={[pt.size, 5, 4]} />
          <meshStandardMaterial color={pt.color} roughness={0.95} metalness={0} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Yamuna River Body ───────────────────────────────────────────────────────
function YamunaRiverBody() {
  const riverPoints = useMemo(() => {
    const list = [];
    for (let z = -16; z <= 16; z += 0.45) {
      const x = 9.5 + Math.sin(z * 0.18) * 1.6 + Math.cos(z * 0.06) * 0.6;
      list.push(new THREE.Vector3(x, 0.015, z));
    }
    return list;
  }, []);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(riverPoints), [riverPoints]);
  const riverSegments = useMemo(() => {
    const list = [];
    const pts = curve.getPoints(70);
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const midX = (p1.x + p2.x) / 2;
      const midZ = (p1.z + p2.z) / 2;
      const dx = p2.x - p1.x;
      const dz = p2.z - p1.z;
      const len = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dx, dz);
      list.push({ x: midX, z: midZ, length: len + 0.06, angle });
    }
    return list;
  }, [curve]);

  return (
    <group>
      {riverSegments.map((seg, idx) => (
        <mesh key={idx} position={[seg.x, 0.012, seg.z]} rotation={[-Math.PI / 2, 0, seg.angle + Math.PI / 2]}>
          <planeGeometry args={[seg.length, 1.45]} />
          <meshStandardMaterial
            color="#082b5c"
            emissive="#05163b"
            emissiveIntensity={1.5}
            roughness={0.06}
            metalness={0.94}
            transparent
            opacity={0.88}
          />
        </mesh>
      ))}
    </group>
  );
}

// ─── Street Lamp Lights ──────────────────────────────────────────────────────
function StreetLampLights() {
  const lampPositions = useMemo(() => {
    const list = [];
    const addLampsAlongSegment = (start, end, interval = 2.4) => {
      const dx = end.x - start.x;
      const dz = end.z - start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const steps = Math.floor(length / interval);
      for (let i = 1; i < steps; i++) {
        const t = i / steps;
        const x = start.x + dx * t;
        const z = start.z + dz * t;
        const perpX = -(dz / length) * 0.18;
        const perpZ = (dx / length) * 0.18;
        list.push({ x: x + perpX, z: z + perpZ });
        list.push({ x: x - perpX, z: z - perpZ });
      }
    };
    for (let z = -12; z <= 12; z += 4) {
      addLampsAlongSegment({ x: -14, z }, { x: 14, z }, 2.8);
    }
    for (let x = -14; x <= 14; x += 4) {
      addLampsAlongSegment({ x, z: -12 }, { x, z: 12 }, 2.8);
    }
    return list;
  }, []);

  return (
    <group>
      {lampPositions.map((pos, idx) => (
        <group key={idx} position={[pos.x, 0.28, pos.z]}>
          <mesh position={[0, -0.14, 0]}>
            <cylinderGeometry args={[0.012, 0.015, 0.28, 6]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
          </mesh>
          <mesh position={[0.02, 0.005, 0]}>
            <sphereGeometry args={[0.022, 6, 6]} />
            <meshBasicMaterial color="#FFB84D" />
          </mesh>
          {idx % 18 === 0 && (
            <pointLight position={[0, 0, 0]} intensity={1.8} color="#FF9933" distance={4.5} />
          )}
        </group>
      ))}
    </group>
  );
}

// ─── Laser Grid Plane for Scan Effect ───────────────────────────────────────
function ScanLaserPlane({ active, offset }) {
  if (!active) return null;
  return (
    <mesh position={[offset - 15, 0.1, 0]}>
      <boxGeometry args={[0.15, 0.3, 30]} />
      <meshBasicMaterial color="#00F5FF" transparent opacity={0.65} />
    </mesh>
  );
}

// ─── Central Core Tower (Nexus Obelisk) Landmark ────────────────────────────
function CentralCoreTower({ stylePreset }) {
  const meshRef = useRef();
  const ringRef = useRef();

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.2;
    }
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.4;
      ringRef.current.rotation.y = t * 0.6;
      ringRef.current.position.y = 2.4 + Math.sin(t * 1.5) * 0.1;
    }
  });

  if (stylePreset === "clay") {
    return (
      <group position={[0, 0, 0]}>
        <mesh position={[0, 1.2, 0]} castShadow>
          <coneGeometry args={[0.4, 2.4, 4]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.7} />
        </mesh>
      </group>
    );
  }

  const color = "#00F5FF";

  return (
    <group position={[0, 0, 0]}>
      {/* Base Platform */}
      <mesh position={[0, 0.08, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[1.1, 1.3, 0.16, 8]} />
        <meshStandardMaterial color="#090d16" roughness={0.2} metalness={0.9} />
      </mesh>
      
      {/* Tiered base */}
      <mesh position={[0, 0.22, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.8, 1.0, 0.12, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} roughness={0.1} />
      </mesh>

      {/* Main Core Obelisk */}
      <group ref={meshRef}>
        <mesh position={[0, 1.4, 0]} castShadow>
          <coneGeometry args={[0.26, 2.2, 4]} />
          <meshStandardMaterial color="#0b0f19" roughness={0.15} metalness={0.95} />
        </mesh>
        {/* Glow channels on sides */}
        {[-0.14, 0.14].flatMap(x => 
          [-0.14, 0.14].map((z, idx) => (
            <mesh key={idx} position={[x, 1.4, z]}>
              <boxGeometry args={[0.02, 2.0, 0.02]} />
              <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.0} />
            </mesh>
          ))
        )}
      </group>

      {/* Floating Power Core Sphere */}
      <mesh position={[0, 2.4, 0]}>
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.8} />
      </mesh>
      
      {/* Floating Outer Ring */}
      <group ref={ringRef} position={[0, 2.4, 0]}>
        <mesh>
          <torusGeometry args={[0.38, 0.015, 8, 24]} />
          <meshBasicMaterial color={color} transparent opacity={0.8} />
        </mesh>
      </group>

      {/* Beacon Light */}
      <BlinkingLight position={[0, 2.7, 0]} />
      <pointLight position={[0, 2.4, 0]} intensity={4.5} color={color} distance={12} />
    </group>
  );
}

// ─── MAIN 3D CITY VIEWER CANVAS ──────────────────────────────────────────────
function City3DScene({
  currentCity,
  stylePreset,
  weather,
  timeOfDay,
  buildings,
  roads,
  parks,
  waters,
  selectedBld,
  onSelectBld,
  onSelectVehicle,
  selectedVehicle,
  sirenActive,
  blackoutActive,
  blackoutWaveRadius,
  blackoutOrigin,
  scanActive,
  scanOffset,
  emergencyTarget,
  congestionMode,
  customSatelliteUrl,
  cameraAutoRotate,
  mapTargetPos,
  showLandmarks,
  showBuildings,
  showRoads,
  showMetro,
  showTraffic,
  showWater,
  showGreen,
  is2D,
  zoomInCounter,
  zoomOutCounter,
  lightningActive,
  textureLoader,
  overriddenLights,
  onToggleLight,
  onSelectLandmark,
  lightShowActive,
  fireworksActive,
  computePriorities
}) {
  const [mapTexture, setMapTexture] = useState(null);

  useEffect(() => {
    let active = true;
    const url = customSatelliteUrl || `${process.env.PUBLIC_URL || ""}/satellite_textures/${currentCity}.png`;
    textureLoader.load(
      url,
      (tex) => {
        if (active) setMapTexture(tex);
      },
      undefined,
      () => {
        if (active) setMapTexture(null);
      }
    );
    return () => { active = false; };
  }, [currentCity, customSatelliteUrl, textureLoader]);

  // Dynamic sun atmosphere lighting settings based on state time of day
  const getLighting = () => {
    if (stylePreset === "hologram") {
      return {
        ambientColor: "#00F5FF", ambientIntensity: 0.06,
        dirColor: "#00F5FF", dirIntensity: 0.08, dirPos: [0, 15, 0]
      };
    }
    if (stylePreset === "clay") {
      return {
        ambientColor: "#ffffff", ambientIntensity: 0.75,
        dirColor: "#ffffff", dirIntensity: 1.3, dirPos: [8, 18, 5]
      };
    }
    
    switch (timeOfDay) {
      case "morning":
        return {
          ambientColor: "#FFECD6", ambientIntensity: 0.5,
          dirColor: "#FFA240", dirIntensity: 1.25, dirPos: [-12, 6, 8]
        };
      case "noon":
        return {
          ambientColor: "#F3F4F6", ambientIntensity: 0.8,
          dirColor: "#FFFFFF", dirIntensity: 1.45, dirPos: [2, 22, 2]
        };
      case "sunset":
        return {
          ambientColor: "#FFA888", ambientIntensity: 0.38,
          dirColor: "#FF4E00", dirIntensity: 0.95, dirPos: [12, 4, -8]
        };
      case "night":
      default:
        return {
          ambientColor: "#0B0F1E", ambientIntensity: 0.14,
          dirColor: "#A78BFA", dirIntensity: 0.32, dirPos: [8, 18, 5]
        };
    }
  };

  const lights = getLighting();
  const dirIntensityVal = lightningActive ? 2.8 : lights.dirIntensity;
  const dirColorVal = lightningActive ? "#E0F2FE" : lights.dirColor;
  const isNightLike = stylePreset === "night" || stylePreset === "satellite" || timeOfDay === "night";

  // Procedural cybergrid ground helper
  const cyberGridTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    
    ctx.fillStyle = "#02040a";
    ctx.fillRect(0, 0, 512, 512);
    
    ctx.strokeStyle = "rgba(0, 245, 255, 0.08)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i, 512);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i); ctx.lineTo(512, i);
      ctx.stroke();
    }
    
    ctx.strokeStyle = "rgba(0, 245, 255, 0.12)";
    ctx.lineWidth = 1.5;
    for (let r = 64; r < 256; r += 64) {
      ctx.beginPath();
      ctx.arc(256, 256, r, 0, Math.PI * 2);
      ctx.stroke();
    }
    
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    return tex;
  }, []);

  // Identify the tallest building in each district to render code badges above
  const tallestDistrictBlds = useMemo(() => {
    const tallestMap = {};
    buildings.forEach(b => {
      const d = b.district;
      if (!tallestMap[d] || b.h > tallestMap[d].h) {
        tallestMap[d] = b;
      }
    });
    return Object.values(tallestMap);
  }, [buildings]);

  return (
    <>
      {stylePreset !== "hologram" && <fogExp2 attach="fog" args={[timeOfDay === "night" ? "#04060b" : "#050a18", 0.022]} />}
      {stylePreset === "hologram" && <fog attach="fog" args={["#020617", 25, 60]} />}

      {/* Lighting Sources */}
      <ambientLight intensity={lights.ambientIntensity} color={lights.ambientColor} />
      <directionalLight
        position={lights.dirPos}
        intensity={dirIntensityVal}
        color={dirColorVal}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      {isNightLike && stylePreset !== "hologram" && (
        <>
          <pointLight position={[-6, 3.5, -6]} color="#FF9F1C" intensity={2.8} distance={20} />
          <pointLight position={[ 6, 3.5,  6]} color="#FF9F1C" intensity={2.8} distance={20} />
          <pointLight position={[-6, 3.5,  6]} color="#FF5500" intensity={2.2} distance={18} />
          <pointLight position={[ 6, 3.5, -6]} color="#00F5FF" intensity={2.0} distance={18} />
        </>
      )}

      <CameraControls
        autoRotate={cameraAutoRotate}
        targetPos={mapTargetPos}
        is2D={is2D}
        zoomInCounter={zoomInCounter}
        zoomOutCounter={zoomOutCounter}
      />

      <WeatherEffects type={weather} lightningActive={lightningActive} />

      {/* Autonomous Cruising Flying Drones */}
      {showTraffic && <FlyingDrones />}

      {/* Holographic scanning target model hovering above building */}
      <HolographicAssistantModel selectedBld={selectedBld} stylePreset={stylePreset} />

      {/* Ground Backdrop */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[32, 32]} />
        <meshStandardMaterial 
          map={stylePreset === "clay" ? null : (stylePreset === "hologram" ? cyberGridTexture : (mapTexture || cyberGridTexture))} 
          color={stylePreset === "clay" ? "#E2E8F0" : stylePreset === "hologram" ? "#010307" : (weather === "snow" ? "#f1f5f9" : (weather === "rain" || weather === "thunderstorm" ? "#04060c" : "#080c18"))} 
          roughness={stylePreset === "clay" ? 0.9 : stylePreset === "hologram" ? 0.95 : (weather === "snow" ? 0.92 : (weather === "rain" || weather === "thunderstorm" ? 0.08 : 0.6))} 
          metalness={stylePreset === "clay" ? 0.1 : stylePreset === "hologram" ? 0.9 : (weather === "snow" ? 0.05 : (weather === "rain" || weather === "thunderstorm" ? 0.88 : 0.2))} 
        />
      </mesh>

      {/* District Boundaries visual overlay */}
      {showRoads && stylePreset !== "clay" && (
        <group>
          {/* Central core sector circle */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[2.42, 2.52, 48]} />
            <meshBasicMaterial color="#00F5FF" side={THREE.DoubleSide} transparent opacity={0.3} />
          </mesh>
          {/* Middle outer sector divider */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
            <ringGeometry args={[10.45, 10.55, 48]} />
            <meshBasicMaterial color="#94A3B8" side={THREE.DoubleSide} transparent opacity={0.22} />
          </mesh>
        </group>
      )}

      {stylePreset === "hologram" && (
        <gridHelper args={[30, 30, "#00f5ff", "rgba(0,245,255,0.05)"]} position={[0, 0.015, 0]} />
      )}

      <RoadLines showRoads={showRoads} />
      {isNightLike && showRoads && <StreetLampLights />}

      {/* Render landmarks dynamically based on current selected City */}
      {showLandmarks && !customSatelliteUrl && (
        <group>
          {currentCity === "delhi" && (
            <>
              <LandmarkModel type="lotus" position={[-1.2, 0, 3.5]} glowColor="#FFE29A" onSelectLandmark={onSelectLandmark} name="Lotus Temple" />
              <LandmarkModel type="gate" position={[0, 0, -0.5]} glowColor="#FFC857" onSelectLandmark={onSelectLandmark} name="India Gate" />
              <LandmarkModel type="minar" position={[-4.5, 0, 1.5]} glowColor="#FFB84D" onSelectLandmark={onSelectLandmark} name="Qutub Minar" />
              <LandmarkModel type="red_fort" position={[1.2, 0, -3.2]} glowColor="#F59E0B" onSelectLandmark={onSelectLandmark} name="Red Fort" />
              <LandmarkModel type="jama_masjid" position={[3.5, 0, -3.5]} glowColor="#F59E0B" onSelectLandmark={onSelectLandmark} name="Jama Masjid" />
              <LandmarkModel type="akshardham" position={[6.0, 0, 4.8]} glowColor="#FF9F1C" onSelectLandmark={onSelectLandmark} name="Akshardham" />

              <MapLabel text="India Gate" position={[0, 2.0, -0.5]} isMajor={true} />
              <MapLabel text="Lotus Temple" position={[-1.2, 1.8, 3.5]} isMajor={true} />
              <MapLabel text="Qutub Minar" position={[-4.5, 3.0, 1.5]} isMajor={true} />
              <MapLabel text="Red Fort" position={[1.2, 1.6, -3.2]} isMajor={true} />
              <MapLabel text="Jama Masjid" position={[3.5, 1.8, -3.5]} isMajor={true} />
              <MapLabel text="Akshardham" position={[6.0, 1.8, 4.8]} isMajor={true} />
            </>
          )}

          {currentCity === "newyork" && (
            <>
              <LandmarkModel type="liberty" position={[-4.5, 0, 3.5]} glowColor="#10B981" onSelectLandmark={onSelectLandmark} name="Statue of Liberty" />
              <LandmarkModel type="eiffel" position={[4.5, 0, -3.5]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="Times Tower" />
              
              <MapLabel text="Statue of Liberty" position={[-4.5, 2.4, 3.5]} isMajor={true} />
              <MapLabel text="Times Tower" position={[4.5, 3.2, -3.5]} isMajor={true} />
            </>
          )}

          {currentCity === "paris" && (
            <>
              <LandmarkModel type="eiffel" position={[0, 0, -1.0]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="Eiffel Tower" />
              <LandmarkModel type="gate" position={[-4.5, 0, 3.5]} glowColor="#E2E8F0" onSelectLandmark={onSelectLandmark} name="Arc de Triomphe" />
              <LandmarkModel type="louvre" position={[3.5, 0, 2.5]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="Louvre Glass Terminal" />
              
              <MapLabel text="Eiffel Tower Node" position={[0, 3.2, -1.0]} isMajor={true} />
              <MapLabel text="Arc de Triomphe" position={[-4.5, 2.0, 3.5]} isMajor={true} />
              <MapLabel text="Louvre Glass Terminal" position={[3.5, 1.4, 2.5]} isMajor={true} />
            </>
          )}

          {currentCity === "tokyo" && (
            <>
              <LandmarkModel type="tokyo_tower" position={[-2.0, 0, -3.5]} glowColor="#EF4444" onSelectLandmark={onSelectLandmark} name="Tokyo Tower" />
              <LandmarkModel type="eiffel" position={[4.5, 0, -2.5]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="Skytree Core" />
              <LandmarkModel type="torii_gate" position={[2.5, 0, 3.5]} glowColor="#EF4444" onSelectLandmark={onSelectLandmark} name="Torii Portal" />
              
              <MapLabel text="Tokyo Tower" position={[-2.0, 3.2, -3.5]} isMajor={true} />
              <MapLabel text="Skytree Core" position={[4.5, 3.4, -2.5]} isMajor={true} />
              <MapLabel text="Torii Portal" position={[2.5, 2.0, 3.5]} isMajor={true} />
            </>
          )}

          {currentCity === "mumbai" && (
            <>
              <LandmarkModel type="gate" position={[0, 0, -2.5]} glowColor="#FF9F1C" onSelectLandmark={onSelectLandmark} name="Gateway of India" />
              <LandmarkModel type="lotus" position={[4.5, 0, 3.5]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="Haji Ali Node" />

              <MapLabel text="Gateway of India" position={[0, 2.0, -2.5]} isMajor={true} />
              <MapLabel text="Haji Ali Node" position={[4.5, 1.8, 3.5]} isMajor={true} />
            </>
          )}

          {currentCity === "bengaluru" && (
            <>
              <LandmarkModel type="akshardham" position={[-3.5, 0, 2.5]} glowColor="#FFB84D" onSelectLandmark={onSelectLandmark} name="Vidhana Soudha" />
              <LandmarkModel type="minar" position={[3.5, 0, -2.5]} glowColor="#00F5FF" onSelectLandmark={onSelectLandmark} name="HAL Aerospace Center" />

              <MapLabel text="Vidhana Soudha" position={[-3.5, 1.8, 2.5]} isMajor={true} />
              <MapLabel text="HAL Aerospace Center" position={[3.5, 3.0, -2.5]} isMajor={true} />
            </>
          )}
        </group>
      )}

      {/* Volumetric Spotlights and Fireworks render for active city landmarks */}
      {showLandmarks && !customSatelliteUrl && isNightLike && (
        <group>
          {currentCity === "delhi" && (
            <>
              <LandmarkSpotlight position={[-1.2, 0.2, 3.5]} color="#FFE29A" active={lightShowActive} />
              <LandmarkSpotlight position={[0, 0.2, -0.5]} color="#FFC857" active={lightShowActive} />
              <LandmarkSpotlight position={[-4.5, 0.2, 1.5]} color="#FFB84D" active={lightShowActive} />
              <LandmarkSpotlight position={[1.2, 0.2, -3.2]} color="#F59E0B" active={lightShowActive} />
              <LandmarkSpotlight position={[3.5, 0.2, -3.5]} color="#F59E0B" active={lightShowActive} />
              <LandmarkSpotlight position={[6.0, 0.2, 4.8]} color="#FF9F1C" active={lightShowActive} />

              <FireworkExplosion position={{ x: -1.2, y: 1.2, z: 3.5 }} color="#FFE29A" active={fireworksActive} />
              <FireworkExplosion position={{ x: 0, y: 1.5, z: -0.5 }} color="#FFC857" active={fireworksActive} />
              <FireworkExplosion position={{ x: -4.5, y: 2.2, z: 1.5 }} color="#FFB84D" active={fireworksActive} />
            </>
          )}
          {currentCity === "newyork" && (
            <>
              <LandmarkSpotlight position={[-4.5, 0.2, 3.5]} color="#10B981" active={lightShowActive} />
              <LandmarkSpotlight position={[4.5, 0.2, -3.5]} color="#00F5FF" active={lightShowActive} />

              <FireworkExplosion position={{ x: -4.5, y: 2.2, z: 3.5 }} color="#10B981" active={fireworksActive} />
              <FireworkExplosion position={{ x: 4.5, y: 3.0, z: -3.5 }} color="#00F5FF" active={fireworksActive} />
            </>
          )}
          {currentCity === "paris" && (
            <>
              <LandmarkSpotlight position={[0, 0.2, -1.0]} color="#00F5FF" active={lightShowActive} />
              <LandmarkSpotlight position={[-4.5, 0.2, 3.5]} color="#E2E8F0" active={lightShowActive} />
              <LandmarkSpotlight position={[3.5, 0.2, 2.5]} color="#00F5FF" active={lightShowActive} />

              <FireworkExplosion position={{ x: 0, y: 3.0, z: -1.0 }} color="#00F5FF" active={fireworksActive} />
              <FireworkExplosion position={{ x: 3.5, y: 1.8, z: 2.5 }} color="#FF2E88" active={fireworksActive} />
            </>
          )}
          {currentCity === "tokyo" && (
            <>
              <LandmarkSpotlight position={[-2.0, 0.2, -3.5]} color="#EF4444" active={lightShowActive} />
              <LandmarkSpotlight position={[4.5, 0.2, -2.5]} color="#00F5FF" active={lightShowActive} />
              <LandmarkSpotlight position={[2.5, 0.2, 3.5]} color="#EF4444" active={lightShowActive} />

              <FireworkExplosion position={{ x: -2.0, y: 3.0, z: -3.5 }} color="#EF4444" active={fireworksActive} />
              <FireworkExplosion position={{ x: 4.5, y: 3.2, z: -2.5 }} color="#00F5FF" active={fireworksActive} />
            </>
          )}
          {currentCity === "mumbai" && (
            <>
              <LandmarkSpotlight position={[0, 0.2, -2.5]} color="#FF9F1C" active={lightShowActive} />
              <LandmarkSpotlight position={[4.5, 0.2, 3.5]} color="#00F5FF" active={lightShowActive} />

              <FireworkExplosion position={{ x: 0, y: 2.0, z: -2.5 }} color="#FF9F1C" active={fireworksActive} />
              <FireworkExplosion position={{ x: 4.5, y: 1.8, z: 3.5 }} color="#00F5FF" active={fireworksActive} />
            </>
          )}
          {currentCity === "bengaluru" && (
            <>
              <LandmarkSpotlight position={[-3.5, 0.2, 2.5]} color="#FFB84D" active={lightShowActive} />
              <LandmarkSpotlight position={[3.5, 0.2, -2.5]} color="#00F5FF" active={lightShowActive} />

              <FireworkExplosion position={{ x: -3.5, y: 1.8, z: 2.5 }} color="#FFB84D" active={fireworksActive} />
              <FireworkExplosion position={{ x: 3.5, y: 2.8, z: -2.5 }} color="#00F5FF" active={fireworksActive} />
            </>
          )}
        </group>
      )}

      {showMetro && (currentCity === "delhi" || currentCity === "paris" || currentCity === "tokyo") && !customSatelliteUrl && (
        <group>
          {currentCity === "delhi" && (
            <>
              <MetroMarker position={[-7.2, 0.3, -6.0]} />
              <MetroMarker position={[-2.2, 0.3, -7.0]} />
              <MetroMarker position={[-8.2, 0.3, 1.0]} />
              <MetroMarker position={[2.0, 0.3, 4.8]} />
            </>
          )}
          {currentCity === "paris" && (
            <>
              <MetroMarker position={[-4.5, 0.3, 3.5]} />
              <MetroMarker position={[0.0, 0.3, -1.0]} />
              <MetroMarker position={[3.5, 0.3, 2.5]} />
              <MetroMarker position={[-1.0, 0.3, -5.0]} />
            </>
          )}
          {currentCity === "tokyo" && (
            <>
              <MetroMarker position={[-2.0, 0.3, -3.5]} />
              <MetroMarker position={[4.5, 0.3, -2.5]} />
              <MetroMarker position={[2.5, 0.3, 3.5]} />
              <MetroMarker position={[0.0, 0.3, 1.2]} />
            </>
          )}
        </group>
      )}

      {showWater && <YamunaRiverBody />}
      {showGreen && <DenseTreeClusters />}
      {showRoads && INTERSECTIONS.map((pos, idx) => (
        <TrafficLight
          key={`tl-${idx}`}
          position={[pos.x, 0.01, pos.z]}
          overriddenLights={overriddenLights}
          onToggleLight={onToggleLight}
        />
      ))}
      {showTraffic && (
        <TrafficFlow
          roads={roads}
          congestionMode={congestionMode}
          onSelectVehicle={onSelectVehicle}
          selectedVehicle={selectedVehicle}
          overriddenLights={overriddenLights}
          computePriorities={computePriorities}
        />
      )}

      <SirenParticle sirenActive={sirenActive} targetPos={emergencyTarget} />
      <BlackoutWave active={blackoutActive} origin={blackoutOrigin} radius={blackoutWaveRadius} />
      <ScanLaserPlane active={scanActive} offset={scanOffset} />

      {/* Majestic central "Infinity Core" Tower obelisk */}
      {showBuildings && <CentralCoreTower stylePreset={stylePreset} />}

      {/* Buildings list render */}
      {showBuildings && buildings.map((b) => {
        let isBuildingBlackedOut = b.blackout;
        if (blackoutActive && blackoutOrigin) {
          const dx = b.x - blackoutOrigin.x;
          const dz = b.z - blackoutOrigin.z;
          if (Math.sqrt(dx * dx + dz * dz) < blackoutWaveRadius) {
            isBuildingBlackedOut = true;
          }
        }
        return (
          <ProceduralBuilding
            key={b.id}
            b={b}
            stylePreset={stylePreset}
            isSelected={selectedBld?.id === b.id}
            isBuildingBlackedOut={isBuildingBlackedOut}
            onSelectBld={onSelectBld}
            weather={weather}
          />
        );
      })}

      {/* Floating HUD Badges above tallest skyscrapers representing each district */}
      {showBuildings && stylePreset !== "clay" && tallestDistrictBlds.map((b) => (
        <MapLabel
          key={`hud-lbl-${b.id}`}
          text={b.districtObj?.code}
          position={[b.x, b.h + 0.9, b.z]}
          isMajor={false}
        />
      ))}
    </>
  );
}

// ─── Compass Dial Overlay Widget ────────────────────────────────────────────
function CompassWidget() {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const handleRotate = (e) => { setRotation(-e.detail.angle); };
    window.addEventListener("nexus-camera-rotate", handleRotate);
    return () => window.removeEventListener("nexus-camera-rotate", handleRotate);
  }, []);

  return (
    <div style={{
      position: "relative", width: 52, height: 52, borderRadius: "50%",
      background: "rgba(10,15,30,0.85)", border: "1px solid rgba(0,245,255,0.22)",
      boxShadow: "0 0 12px rgba(0,245,255,0.18)", display: "flex", alignItems: "center", justifyContent: "center"
    }}>
      <svg width="48" height="48" viewBox="0 0 100 100" style={{ transform: `rotate(${rotation}deg)`, transition: "transform 0.05s linear" }}>
        <text x="50" y="18" fill="#FFFFFF" fontSize="13" fontWeight="bold" textAnchor="middle" style={{ fontFamily: "Space Grotesk, sans-serif" }}>N</text>
        <text x="50" y="93" fill="#64748B" fontSize="13" fontWeight="bold" textAnchor="middle" style={{ fontFamily: "Space Grotesk, sans-serif" }}>S</text>
        <text x="86" y="55" fill="#64748B" fontSize="13" fontWeight="bold" textAnchor="middle" style={{ fontFamily: "Space Grotesk, sans-serif" }}>E</text>
        <text x="14" y="55" fill="#64748B" fontSize="13" fontWeight="bold" textAnchor="middle" style={{ fontFamily: "Space Grotesk, sans-serif" }}>W</text>
        <circle cx="50" cy="50" r="36" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="2,4" />
        <polygon points="50,24 45,50 50,46" fill="#EF4444" />
        <polygon points="50,76 45,50 50,46" fill="#64748B" />
        <circle cx="50" cy="50" r="4" fill="#FFFFFF" />
      </svg>
    </div>
  );
}

// ─── MAIN COMPONENT: 3D INTERACTIVE CITY DASHBOARD ───────────────────────────
export default function CityCenter3D() {
  const [currentCity, setCurrentCity] = useState("delhi");
  const [stylePreset, setStylePreset] = useState("satellite");
  const [weather, setWeather] = useState("clear");
  const [timeOfDay, setTimeOfDay] = useState("night");
  const [autoAtmosphereCycle, setAutoAtmosphereCycle] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [lightningActive, setLightningActive] = useState(false);
  const [cameraAutoRotate, setCameraAutoRotate] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editTool, setEditTool] = useState("build_commercial");
  const [selectedBld, setSelectedBld] = useState(null);
  
  // Interactive 3D City State Extensions
  const [overriddenLights, setOverriddenLights] = useState({});
  const [selectedLandmark, setSelectedLandmark] = useState(null);
  const [lightShowActive, setLightShowActive] = useState(true);
  const [fireworksActive, setFireworksActive] = useState(false);
  const [computePriorities, setComputePriorities] = useState({
    security: 33,
    transit: 33,
    energy: 34
  });
  const [terminalLog, setTerminalLog] = useState([
    "System Initialized.",
    "Grid mapping module online: sector_3d_viewer.",
  ]);
  const [ttsMuted, setTtsMuted] = useState(true);
  const [aiResponseText, setAiResponseText] = useState(
    "Welcome to the 3D City Center Optimization portal. I am your Urban AI Assistant. Tap 'SPEAK' or chat to query advice on sector allocation, congestion ratings, or grid planning."
  );

  const [sirenActive, setSirenActive] = useState(false);
  const [emergencyTarget, setEmergencyTarget] = useState(null);
  const [blackoutActive, setBlackoutActive] = useState(false);
  const [blackoutWaveRadius, setBlackoutWaveRadius] = useState(0);
  const [blackoutOrigin, setBlackoutOrigin] = useState(null);
  const [congestionMode, setCongestionMode] = useState(false);
  const [aqiIndex] = useState(115);
  const [trafficFlowSpeed, setTrafficFlowSpeed] = useState(48);
  const [buildings, setBuildings] = useState([]);
  const [roads, setRoads] = useState([]);
  const [parks, setParks] = useState([]);
  const [waters, setWaters] = useState([]);
  const [mapTargetPos, setMapTargetPos] = useState({ x: 0, z: 0 });

  const [customSatelliteUrl, setCustomSatelliteUrl] = useState(null);
  const [customFileName, setCustomFileName] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [scanOffset, setScanOffset] = useState(0);

  const [bldDensity, setBldDensity] = useState(55);
  const [maxHeightScale, setMaxHeightScale] = useState(1.0);
  const [isLoadingCity, setIsLoadingCity] = useState(false);

  const [showLayers, setShowLayers] = useState({
    landmarks: true,
    buildings: true,
    roads: true,
    metro: true,
    traffic: true,
    water: true,
    green: true
  });
  
  const [activeCategory, setActiveCategory] = useState("Landmarks");
  const [is2D, setIs2D] = useState(false);
  const [zoomInCounter, setZoomInCounter] = useState(0);
  const [zoomOutCounter, setZoomOutCounter] = useState(0);

  const [aiChatInput, setAiChatInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Simulated District Sub-app data states
  const [coreCPU, setCoreCPU] = useState(42);
  const [coreRAM, setCoreRAM] = useState(65);
  const [coreGPU, setCoreGPU] = useState(28);
  const [finData, setFinData] = useState([
    { time: "10:00", Price: 1240 },
    { time: "10:05", Price: 1252 },
    { time: "10:10", Price: 1248 },
    { time: "10:15", Price: 1263 },
    { time: "10:20", Price: 1270 },
  ]);
  const [ecgPoints, setEcgPoints] = useState([]);
  const [shoppingDroneProgress, setShoppingDroneProgress] = useState(0);
  const [shoppingDroneActive, setShoppingDroneActive] = useState(true);
  const [droneBoosted, setDroneBoosted] = useState(false);
  const [educCode, setEducCode] = useState('function processCity() {\n  return "Infinity OS: Nominal";\n}');
  const [educResult, setEducResult] = useState("");
  const [educRunning, setEducRunning] = useState(false);
  const [todoTasks, setTodoTasks] = useState([
    "Check Core CPU load",
    "Approve financial ledgers",
    "Inspect Smart Home security feeds"
  ]);
  const [todoInput, setTodoInput] = useState("");
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [audioTrackIdx, setAudioTrackIdx] = useState(0);
  const [audioProgress, setAudioProgress] = useState(30);
  const [activeCameraId, setActiveCameraId] = useState(1);
  const [smartLightBrightness, setSmartLightBrightness] = useState(70);
  const [smartLockSecured, setSmartLockSecured] = useState(true);
  const [securityScanning, setSecurityScanning] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState("");
  const [citySearchResults, setCitySearchResults] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([
    "Port 80 Sentinel Active.",
    "No intrusions detected on local interfaces."
  ]);

  const addLog = useCallback((msg) => {
    setTerminalLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 12)]);
  }, []);

  const handleAiSpeech = useCallback((text) => {
    if (ttsMuted) return;
    speak(text, {
      rate: 1.05,
      pitch: 0.98,
      onStart: () => addLog("AI Voice: Broadcasting transmission..."),
      onEnd: () => addLog("AI Voice: Broadcast idle."),
    });
  }, [ttsMuted, addLog]);

  const handleToggleLight = useCallback((x, z) => {
    const key = `${x},${z}`;
    setOverriddenLights(prev => {
      const current = prev[key] || getTrafficLightState(x, z, performance.now() / 1000);
      let nextState = "green";
      if (current === "green") nextState = "yellow";
      else if (current === "yellow") nextState = "red";
      else if (current === "red") nextState = "auto";
      
      const updated = { ...prev };
      if (nextState === "auto") {
        delete updated[key];
        addLog(`Traffic signal at (${x}, ${z}) returned to standard schedule.`);
      } else {
        updated[key] = nextState;
        addLog(`Traffic signal at (${x}, ${z}) overridden to ${nextState.toUpperCase()}.`);
      }
      return updated;
    });
  }, [addLog]);

  const handleSelectLandmark = useCallback((landmark) => {
    setSelectedLandmark(landmark);
    setSelectedBld(null);
    setSelectedVehicle(null);
    if (landmark) {
      setMapTargetPos({ x: landmark.position[0], z: landmark.position[2] });
      addLog(`Inspecting Landmark Node: ${landmark.name}`);
      const ttsMsg = `Synchronizing telemetry with ${landmark.name} smart grid node.`;
      setAiResponseText(ttsMsg);
      handleAiSpeech(ttsMsg);
    }
  }, [addLog, handleAiSpeech]);

  const triggerEmergencyResponse = useCallback(() => {
    if (!selectedBld) return;
    setSirenActive(true);
    setEmergencyTarget({ x: selectedBld.x, z: selectedBld.z });
    addLog(`Emergency dispatched to Building Node at (${selectedBld.x}, ${selectedBld.z}). Siren online.`);
    const dispatchMsg = `Dispatching autonomous emergency pods to ${selectedBld.districtObj?.name || 'building node'}. Priority route cleared.`;
    setAiResponseText(dispatchMsg);
    handleAiSpeech(dispatchMsg);
  }, [selectedBld, addLog, handleAiSpeech]);

  const triggerBlackout = useCallback(() => {
    if (blackoutActive) return;
    setBlackoutActive(true);
    setBlackoutWaveRadius(0);
    const origin = selectedBld ? { x: selectedBld.x, z: selectedBld.z } : { x: 0, z: 0 };
    setBlackoutOrigin(origin);
    addLog(`ALERT: Cascading grid shutdown from (${origin.x}, ${origin.z})`);
    const warningText = `Grid Overload detected in sector grid. Initiating cascading brownout. Turning off primary block power lines.`;
    setAiResponseText(warningText);
    handleAiSpeech(warningText);
  }, [blackoutActive, selectedBld, addLog, handleAiSpeech]);

  const restoreBlackout = useCallback(() => {
    setBuildings(prev => prev.map(b => ({ ...b, blackout: false })));
    setBlackoutActive(false);
    setBlackoutWaveRadius(0);
    addLog("Blackout resolved. Re-establishing full grid connectivity.");
    const restoreText = "Power grid failure resolved. Grid nodes restored and synchronized.";
    setAiResponseText(restoreText);
    handleAiSpeech(restoreText);
  }, [addLog, handleAiSpeech]);

  const triggerCongestionTest = useCallback(() => {
    setCongestionMode(prev => {
      const mode = !prev;
      setTrafficFlowSpeed(mode ? 14 : 48);
      addLog(mode ? "TRAFFIC CONGESTION ALERT: Initiated gridlock test." : "Traffic congestion test ended.");
      return mode;
    });
  }, [addLog]);

  const parseNlpCommands = useCallback((text) => {
    if (!text) return;
    const lower = text.toLowerCase();
    if (lower.includes("blackout") || lower.includes("power off") || lower.includes("dark")) {
      triggerBlackout();
    } else if (lower.includes("restore") || lower.includes("power on") || lower.includes("light on")) {
      restoreBlackout();
    } else if (lower.includes("rain") || lower.includes("storm") || lower.includes("thunder")) {
      setWeather("thunderstorm");
    } else if (lower.includes("clear") || lower.includes("sun") || lower.includes("day")) {
      setWeather("clear");
      setTimeOfDay("noon");
    } else if (lower.includes("night")) {
      setTimeOfDay("night");
    } else if (lower.includes("traffic") || lower.includes("congestion") || lower.includes("jam")) {
      triggerCongestionTest();
    } else if (lower.includes("emergency") || lower.includes("siren") || lower.includes("dispatch")) {
      if (selectedBld) triggerEmergencyResponse();
    }
  }, [selectedBld, triggerBlackout, restoreBlackout, triggerCongestionTest, triggerEmergencyResponse]);

  const handleLocalChatFallback = useCallback((userQuery) => {
    const lower = userQuery.toLowerCase();
    let reply = `[NEXUS City AI] Processing query: "${userQuery}". Sector grid operating at normal telemetry capacity. All 10 districts online.`;
    if (lower.includes("status") || lower.includes("health") || lower.includes("report")) {
      reply = `[NEXUS City AI] 3D Digital Twin Report: ${buildings.length} active building structures, ${roads.length} road grid segments, AQI index: ${aqiIndex} (Moderate), Traffic velocity: ${trafficFlowSpeed} km/h.`;
    } else if (lower.includes("district") || lower.includes("zone")) {
      reply = `[NEXUS City AI] 10 Sector Districts configured: Infinity Core, Financial, Shopping, Entertainment, Medical, Smart Home, Transport, Education, Productivity, and Security.`;
    }
    setAiResponseText(reply);
    handleAiSpeech(reply);
  }, [buildings.length, roads.length, aqiIndex, trafficFlowSpeed, handleAiSpeech]);

  // Global mouse tracker for high-performance direct DOM tooltip
  useEffect(() => {
    const handleGlobalMouseMove = (e) => {
      const tooltip = document.getElementById("city-hud-tooltip");
      if (tooltip && tooltip.style.display === "block") {
        tooltip.style.top = `${e.clientY - 130}px`;
        tooltip.style.left = `${e.clientX + 22}px`;
      }
    };
    window.addEventListener("mousemove", handleGlobalMouseMove);
    return () => window.removeEventListener("mousemove", handleGlobalMouseMove);
  }, []);

  // Building & District Search States
  const handleCitySearch = (query) => {
    setCitySearchQuery(query);
    if (!query.trim()) {
      setCitySearchResults([]);
      return;
    }
    const q = query.toLowerCase();
    const matches = buildings.filter(b => 
      b.id.toLowerCase().includes(q) || 
      b.district.toLowerCase().includes(q) || 
      b.districtObj?.name.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q)
    ).slice(0, 5);
    setCitySearchResults(matches);
  };

  const audioTracks = useMemo(() => ["Cyber-Nexus Beats (Lo-Fi)", "Quantum Skyline", "Holographic Dusk"], []);

  // Thunderstorm lighting flash runner
  useEffect(() => {
    if (weather === "thunderstorm") {
      const triggerFlash = () => {
        setLightningActive(true);
        setTimeout(() => setLightningActive(false), 80 + Math.random() * 120);
        setTimeout(triggerFlash, 3000 + Math.random() * 8000);
      };
      const timer = setTimeout(triggerFlash, 4000);
      return () => clearTimeout(timer);
    } else {
      setLightningActive(false);
    }
  }, [weather]);

  // Auto atmosphere cycle runner
  useEffect(() => {
    let iv;
    if (autoAtmosphereCycle) {
      const times = ["morning", "noon", "sunset", "night"];
      iv = setInterval(() => {
        setTimeOfDay(prev => {
          const idx = times.indexOf(prev);
          const nextIdx = (idx + 1) % times.length;
          addLog(`Atmosphere automatically cycled to ${times[nextIdx].toUpperCase()}`);
          return times[nextIdx];
        });
      }, 10000);
    }
    return () => clearInterval(iv);
  }, [autoAtmosphereCycle, addLog]);

  // Core sector resource dynamic load fluctuation
  useEffect(() => {
    const iv = setInterval(() => {
      setCoreCPU(prev => Math.min(100, Math.max(10, prev + Math.floor((Math.random() - 0.5) * 8))));
      setCoreRAM(prev => Math.min(100, Math.max(10, prev + Math.floor((Math.random() - 0.5) * 4))));
      setCoreGPU(prev => Math.min(100, Math.max(10, prev + Math.floor((Math.random() - 0.5) * 10))));
    }, 1500);
    return () => clearInterval(iv);
  }, []);

  // Stock Market ticker simulator
  useEffect(() => {
    const iv = setInterval(() => {
      setFinData(prev => {
        const lastPrice = prev[prev.length - 1].Price;
        const newPrice = lastPrice + (Math.random() - 0.5) * 20;
        const now = new Date().toLocaleTimeString().slice(-8);
        return [...prev.slice(-6), { time: now, Price: parseFloat(newPrice.toFixed(2)) }];
      });
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  // ECG biometrics scanner heartbeat wave simulator
  useEffect(() => {
    let tick = 0;
    const iv = setInterval(() => {
      tick++;
      setEcgPoints(prev => {
        const baseSine = Math.sin(tick * 0.4) * 8 + 30;
        let spike = 0;
        if (tick % 12 === 0) spike = 75;
        else if (tick % 12 === 1) spike = -20;
        const ECG = baseSine + spike;
        return [...prev.slice(-25), { time: tick, ECG }];
      });
    }, 150);
    return () => clearInterval(iv);
  }, []);

  // Delivery Drone progress tracker
  useEffect(() => {
    let iv;
    if (shoppingDroneActive) {
      iv = setInterval(() => {
        setShoppingDroneProgress(prev => {
          const step = droneBoosted ? 12 : 5;
          if (prev >= 100) {
            setDroneBoosted(false);
            return 0;
          }
          return prev + step;
        });
      }, 1000);
    }
    return () => clearInterval(iv);
  }, [shoppingDroneActive, droneBoosted]);

  // Audio track slider runner
  useEffect(() => {
    let iv;
    if (audioPlaying) {
      iv = setInterval(() => {
        setAudioProgress(prev => {
          if (prev >= 100) {
            setAudioTrackIdx(t => (t + 1) % audioTracks.length);
            return 0;
          }
          return prev + 1.5;
        });
      }, 800);
    }
    return () => clearInterval(iv);
  }, [audioPlaying, audioTracks.length]);

  // Re-generate city and assign properties
  const generateCityGeometry = useCallback((imgSrc, densityScale, heightFactor) => {
    setIsLoadingCity(true);
    addLog(`Scanning image source for Smart Twin classification...`);
    setScanActive(true);
    setScanOffset(0);

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imgSrc;
    
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 48;
      canvas.height = 48;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, 48, 48);
      
      const imgData = ctx.getImageData(0, 0, 48, 48).data;
      const blds = [];
      const rds = [];
      const pks = [];
      const wtr = [];

      for (let y = 0; y < 48; y++) {
        for (let x = 0; x < 48; x++) {
          const idx = (y * 48 + x) * 4;
          const r = imgData[idx];
          const g = imgData[idx + 1];
          const b = imgData[idx + 2];

          const posX = (x - 24) * 0.62;
          const posZ = (y - 24) * 0.62;

          const isBlue = b > r + 15 && b > g + 15;
          const isGreen = g > r + 15 && g > b + 15;
          const isRoadDark = r < 75 && g < 75 && b < 75;
          const isBuildingBright = r > 128 && g > 128 && b > 128;

          if (isBlue) {
            wtr.push({ x: posX, z: posZ });
          } else if (isGreen) {
            pks.push({ x: posX, z: posZ });
          } else if (isRoadDark) {
            rds.push({ x: posX, z: posZ });
          } else if (isBuildingBright || Math.random() * 100 < densityScale) {
            const distToCenter = Math.sqrt(posX * posX + posZ * posZ);
            if (distToCenter < 1.4) continue; // Skip to make room for CentralCoreTower

            // Apply city-specific scaling
            let cityHeightMultiplier = 1.0;
            if (currentCity === "mumbai") cityHeightMultiplier = 1.4;
            else if (currentCity === "newyork") cityHeightMultiplier = 2.1;
            else if (currentCity === "bengaluru") cityHeightMultiplier = 0.8;
            else if (currentCity === "paris") cityHeightMultiplier = 1.1;
            else if (currentCity === "tokyo") cityHeightMultiplier = 1.8;

            const height = (0.45 + (r + g + b) / 320 * 1.9) * heightFactor * cityHeightMultiplier;
            const zone = height > 1.6 ? "commercial" : "residential";
            const districtObj = getDistrictByCoords(posX, posZ);

            const rSeed = Math.random();
            let rStyle = "none";
            if (zone === "commercial") {
              if (height > 1.8) {
                rStyle = rSeed > 0.7 ? "helipad" : rSeed > 0.4 ? "antenna" : "tapered";
              } else {
                rStyle = rSeed > 0.5 ? "hvac" : "none";
              }
            } else {
              rStyle = rSeed > 0.8 ? "watertower" : rSeed > 0.5 ? "hvac" : "none";
            }

            blds.push({
              id: `bld-${x}-${y}-${Math.floor(Math.random()*900)}`,
              x: posX,
              z: posZ,
              w: 0.42,
              d: 0.42,
              h: height,
              type: zone,
              blackout: false,
              district: districtObj.id,
              districtObj: districtObj,
              occupancy: Math.floor(Math.random() * 150) + 40,
              maxOccupancy: Math.floor(height * 100),
              energyEfficiency: Math.floor(Math.random() * 30) + 65,
              roofStyle: rStyle
            });
          }
        }
      }

      setBuildings(blds);
      setRoads(rds);
      setParks(pks);
      setWaters(wtr);
      setIsLoadingCity(false);
      addLog(`Digital Twin synced: Extruded ${blds.length} buildings categorized into 10 Districts.`);
    };

    img.onerror = () => {
      const blds = [];
      const pks = [];

      let cityHeightMultiplier = 1.0;
      if (currentCity === "mumbai") cityHeightMultiplier = 1.4;
      else if (currentCity === "newyork") cityHeightMultiplier = 2.1;
      else if (currentCity === "bengaluru") cityHeightMultiplier = 0.8;
      else if (currentCity === "paris") cityHeightMultiplier = 1.1;
      else if (currentCity === "tokyo") cityHeightMultiplier = 1.8;

      for (let x = -10; x <= 10; x += 2.2) {
        for (let z = -10; z <= 10; z += 2.2) {
          const distToCenter = Math.sqrt(x*x + z*z);
          if (distToCenter < 1.4) continue;

          if (Math.random() * 100 < densityScale) {
            const h = (0.5 + Math.random() * 2.2) * heightFactor * cityHeightMultiplier;
            const districtObj = getDistrictByCoords(x, z);
            const rSeed = Math.random();
            const rStyle = h > 1.5 ? (rSeed > 0.7 ? "helipad" : rSeed > 0.4 ? "antenna" : "tapered") : (rSeed > 0.7 ? "watertower" : rSeed > 0.4 ? "hvac" : "none");

            blds.push({
              id: `bld-fallback-${x}-${z}`,
              x, z, w: 0.65, d: 0.65, h,
              type: h > 1.5 ? "commercial" : "residential",
              blackout: false,
              district: districtObj.id,
              districtObj: districtObj,
              occupancy: 80, maxOccupancy: 120, energyEfficiency: 82,
              roofStyle: rStyle
            });
          } else {
            pks.push({ x: x + 0.5, z: z + 0.5 });
          }
        }
      }
      setBuildings(blds);
      setParks(pks);
      setIsLoadingCity(false);
      addLog(`Fallback procedural map loaded for ${currentCity.toUpperCase()}.`);
    };
  }, [currentCity, addLog]);

  const textureLoader = useMemo(() => new THREE.TextureLoader(), []);

  useEffect(() => {
    if (!customSatelliteUrl) {
      generateCityGeometry(`${process.env.PUBLIC_URL || ""}/satellite_textures/${currentCity}.png`, bldDensity, maxHeightScale);
    }
  }, [currentCity, customSatelliteUrl, bldDensity, maxHeightScale, generateCityGeometry]);

  // Sweep animation runner
  useEffect(() => {
    if (scanActive) {
      let frame = 0;
      const interval = setInterval(() => {
        frame += 1;
        setScanOffset(frame * 1.1);
        if (frame >= 28) {
          setScanActive(false);
          clearInterval(interval);
        }
      }, 35);
      return () => clearInterval(interval);
    }
  }, [scanActive]);

  // Blackout wave timer updates
  useEffect(() => {
    if (blackoutActive) {
      const interval = setInterval(() => {
        setBlackoutWaveRadius(prev => {
          if (prev > 26) {
            setBlackoutActive(false);
            return 0;
          }
          return prev + 0.95;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [blackoutActive]);

  const handleSatelliteUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomFileName(file.name);
    addLog(`Uploaded satellite image: ${file.name}`);
    const localUrl = URL.createObjectURL(file);
    setCustomSatelliteUrl(localUrl);
    generateCityGeometry(localUrl, bldDensity, maxHeightScale);
  };

  const clearCustomUpload = () => {
    setCustomSatelliteUrl(null);
    setCustomFileName("");
    setCurrentCity("delhi");
    addLog("Custom map cleared. Reloading Delhi base map.");
  };

  const toggleLayer = (layerKey) => {
    setShowLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
    addLog(`Layer toggled: ${layerKey}`);
  };

  const handleCategoryClick = (cat) => {
    setActiveCategory(cat);
    addLog(`Viewing category: ${cat}`);
    if (cat === "Landmarks") setMapTargetPos({ x: 0, z: -0.5 });
    else if (cat === "Hotels") setMapTargetPos({ x: -2.2, z: -2.5 });
    else if (cat === "Hospitals") setMapTargetPos({ x: -7.0, z: -6.5 });
    else if (cat === "Schools") setMapTargetPos({ x: -2.0, z: -7.5 });
    else if (cat === "Malls") setMapTargetPos({ x: 1.8, z: 5.2 });
    else if (cat === "Metro Stations") setMapTargetPos({ x: -8.5, z: 0.5 });
    else if (cat === "Parks") setMapTargetPos({ x: 6.0, z: 4.8 });
  };

  const handleMapClick = (e) => {
    if (!isEditMode) return;
    const clickX = Math.round(e.point.x * 10) / 10;
    const clickZ = Math.round(e.point.z * 10) / 10;

    if (editTool === "demolish") {
      let nearest = null;
      let minDist = 1.0;
      buildings.forEach(b => {
        const d = Math.sqrt((b.x - clickX)**2 + (b.z - clickZ)**2);
        if (d < minDist) {
          minDist = d;
          nearest = b;
        }
      });
      if (nearest) {
        setBuildings(prev => prev.filter(b => b.id !== nearest.id));
        addLog(`Demolished building at (${nearest.x}, ${nearest.z})`);
        if (selectedBld?.id === nearest.id) setSelectedBld(null);
      }
    } else if (editTool.startsWith("build_")) {
      const type = editTool.replace("build_", "");
      const districtObj = getDistrictByCoords(clickX, clickZ);
      const newBld = {
        id: `custom-bld-${Date.now()}`,
        x: clickX,
        z: clickZ,
        w: 0.6,
        d: 0.6,
        h: type === "commercial" ? 2.1 : 0.95,
        type: type,
        color: districtObj.color,
        district: districtObj.id,
        districtObj: districtObj,
        occupancy: 0,
        maxOccupancy: type === "commercial" ? 180 : 60,
        energyEfficiency: 95,
        blackout: false,
      };
      
      if (type === "park") {
        setParks(prev => [...prev, { x: clickX, z: clickZ }]);
        addLog(`Placed green zone park corridor at (${clickX}, ${clickZ})`);
      } else {
        setBuildings(prev => [...prev, newBld]);
        setSelectedBld(newBld);
        addLog(`Erected 3D ${type} structure at (${clickX}, ${clickZ})`);
      }
    } else if (editTool === "draw_road") {
      setRoads(prev => [...prev, { x: clickX, z: clickZ }]);
      addLog(`Added road node at coordinate grid (${clickX}, ${clickZ})`);
    }
  };

  const inspectBuilding = (bld) => {
    setSelectedBld(bld);
    setSelectedVehicle(null);
    setMapTargetPos({ x: bld.x, z: bld.z });
    addLog(`Inspecting Building: [${bld.districtObj?.name || 'Smart Structure'}] ID: ${bld.id.substring(0, 8)}`);
    const ttsResponse = `Syncing node in ${bld.districtObj?.name}. Loading sector console and diagnostic applications.`;
    setAiResponseText(ttsResponse);
    handleAiSpeech(ttsResponse);
  };

  const inspectVehicle = (veh) => {
    setSelectedVehicle(veh);
    setSelectedBld(null);
    addLog(`Syncing autonomous transit pod telemetry: [${veh.id}]`);
    const ttsResponse = `Syncing transit pod ${veh.id}. Visualizing telemetry speed index.`;
    setAiResponseText(ttsResponse);
    handleAiSpeech(ttsResponse);
  };

  const handleHeightExtrusion = (newVal) => {
    if (!selectedBld) return;
    setBuildings(prev => prev.map(b => {
      if (b.id === selectedBld.id) {
        const updated = { ...b, h: parseFloat(newVal) };
        setSelectedBld(updated);
        return updated;
      }
      return b;
    }));
  };

  const toggleBuildingSolar = () => {
    if (!selectedBld) return;
    const newState = !selectedBld.hasSolar;
    setBuildings(prev => prev.map(b => {
      if (b.id === selectedBld.id) {
        const updated = {
          ...b,
          hasSolar: newState,
          energyEfficiency: newState ? Math.min(100, b.energyEfficiency + 12) : Math.max(0, b.energyEfficiency - 12)
        };
        setSelectedBld(updated);
        return updated;
      }
      return b;
    }));
    addLog(newState ? `Installed Smart Solar Array on Node ${selectedBld.id.substring(0,8)}` : `Removed Solar Array from Node ${selectedBld.id.substring(0,8)}`);
  };

  const toggleBuildingGarden = () => {
    if (!selectedBld) return;
    const newState = !selectedBld.hasGarden;
    setBuildings(prev => prev.map(b => {
      if (b.id === selectedBld.id) {
        const updated = {
          ...b,
          hasGarden: newState,
          energyEfficiency: newState ? Math.min(100, b.energyEfficiency + 8) : Math.max(0, b.energyEfficiency - 8)
        };
        setSelectedBld(updated);
        return updated;
      }
      return b;
    }));
    addLog(newState ? `Planted Bio Sky Garden on Node ${selectedBld.id.substring(0,8)}` : `Removed Sky Garden from Node ${selectedBld.id.substring(0,8)}`);
  };

  const handleChatSubmit = (e) => {
    e.preventDefault();
    if (!aiChatInput.trim()) return;

    const userQuery = aiChatInput.trim();
    addLog(`User: ${userQuery}`);
    setAiChatInput("");
    setAiLoading(true);
    setAiResponseText(""); // Clear previous text

    // Parse NLP command triggers from user query immediately
    parseNlpCommands(userQuery);

    let fullText = "";
    streamChat({
      session_id: "city-twin-session",
      agent: "nexus-core",
      message: userQuery,
      onMeta: () => {},
      onDelta: (delta) => {
        fullText += delta;
        setAiResponseText(fullText);
      },
      onDone: () => {
        setAiLoading(false);
        handleAiSpeech(fullText);
        // Also parse command triggers from the AI's response text if any
        parseNlpCommands(fullText);
      },
      onError: (err) => {
        setAiLoading(false);
        setAiResponseText(`Server disconnected. Fallback to local diagnostics:\n`);
        handleLocalChatFallback(userQuery);
      }
    });
  };

  // Run code mock executor in Education sector
  const executeSandboxCode = () => {
    setEducRunning(true);
    setEducResult("> Compiling scripts...");
    setTimeout(() => {
      setEducResult(prev => prev + "\n> Executing in sandboxed browser container...");
      setTimeout(() => {
        try {
          if (educCode.includes("speak")) {
            speak("Visual Smart City operational.");
          }
          setEducResult(prev => prev + `\n> Output: "Infinity OS: Nominal"\n> Execution finished: 0 errors (Code 200)`);
        } catch (e) {
          setEducResult(prev => prev + `\n> Error: ${e.message}`);
        }
        setEducRunning(false);
      }, 700);
    }, 600);
  };

  // Add todo task in Productivity sector
  const handleAddTodo = (e) => {
    e.preventDefault();
    if (!todoInput.trim()) return;
    setTodoTasks(prev => [...prev, todoInput.trim()]);
    setTodoInput("");
    addLog("Added new workspace task checklist.");
  };

  // Threat scanning runner in Security sector
  const runSecurityScan = () => {
    setSecurityScanning(true);
    setSecurityLogs(["> Initializing port scanning sequence..."]);
    let progress = 0;
    const iv = setInterval(() => {
      progress += 25;
      setSecurityLogs(prev => [...prev, `> Querying interface port ${progress * 4}... OK`]);
      if (progress >= 100) {
        clearInterval(iv);
        setSecurityLogs(prev => [
          ...prev,
          "> Scanning complete. Firewall status: 100% SECURE.",
          "> Zero vulnerabilities or threat vectors detected."
        ]);
        setSecurityScanning(false);
      }
    }, 400);
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      width: "100%",
      minHeight: "100vh",
      background: "#070B19",
      color: "#F8FAFC",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflowY: "auto",
      padding: "16px 20px 24px 20px",
      boxSizing: "border-box",
      gap: 16
    }} className="nx-fadein">
      
      {/* ─── 1. TOP HEADER BAR ────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "rgba(13, 20, 38, 0.85)",
        backdropFilter: "blur(16px)",
        border: "1px solid rgba(0, 245, 255, 0.15)",
        borderRadius: 14,
        padding: "10px 20px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
      }}>
        {/* Left Branding */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, rgba(0,245,255,0.2), rgba(59,130,246,0.3))",
            border: "1px solid rgba(0,245,255,0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 16px rgba(0, 245, 255, 0.3)"
          }}>
            <Globe style={{ width: 22, height: 22, color: "#00F5FF" }} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, letterSpacing: "0.08em", color: "#FFFFFF", textShadow: "0 0 12px rgba(0, 245, 255, 0.4)" }}>
              SMART CITY <span style={{ color: "#00F5FF" }}>AI OS</span>
            </div>
            <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.15em", color: "#64748B" }}>
              INTELLIGENT · CONNECTED · SUSTAINABLE
            </div>
          </div>
        </div>

        {/* Center Search Bar */}
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "rgba(15, 23, 42, 0.6)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: 20, padding: "7px 16px", width: 340
        }}>
          <Search style={{ width: 14, height: 14, color: "#64748B" }} />
          <input
            type="text"
            placeholder="Search city, services, people..."
            value={citySearchQuery}
            onChange={(e) => handleCitySearch(e.target.value)}
            style={{
              background: "transparent", border: "none", outline: "none",
              color: "#E2E8F0", fontSize: 12, width: "100%"
            }}
          />
        </div>

        {/* Right Status Badges, Clock & Admin Profile */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {/* System Operational Badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: 20, padding: "5px 12px"
          }}>
            <span className="nx-blink" style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#10B981" }}>System Status: Operational</span>
          </div>

          {/* AI Brain Active Badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(168, 85, 247, 0.1)",
            border: "1px solid rgba(168, 85, 247, 0.3)",
            borderRadius: 20, padding: "5px 12px"
          }}>
            <Brain style={{ width: 13, height: 13, color: "#C084FC" }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: "#C084FC" }}>AI Brain: Active</span>
          </div>

          {/* Real-time Clock */}
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#F8FAFC", fontFamily: "monospace" }}>
              {new Date().toLocaleTimeString()}
            </div>
            <div style={{ fontSize: 9, color: "#64748B", fontWeight: 600 }}>
              {new Date().toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>

          {/* Notification Bell */}
          <div style={{
            position: "relative", width: 34, height: 34, borderRadius: "50%",
            background: "rgba(30, 41, 59, 0.6)", border: "1px solid rgba(255,255,255,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer"
          }}>
            <Bell style={{ width: 15, height: 15, color: "#94A3B8" }} />
            <span style={{
              position: "absolute", top: -2, right: -2, width: 15, height: 15,
              borderRadius: "50%", background: "#EF4444", color: "#FFF",
              fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center"
            }}>8</span>
          </div>

          {/* Admin Avatar */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 8, borderLeft: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{
              width: 32, height: 32, borderRadius: "50%",
              background: "linear-gradient(135deg, #3B82F6, #8B5CF6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: 13, color: "#FFF"
            }}>P</div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F8FAFC" }}>Admin</div>
              <div style={{ fontSize: 9, color: "#64748B" }}>City Operator</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 2. TOP KPI SUMMARY CARDS GRID ────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
        
        {/* Card 1: Total Population */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(0, 245, 255, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>TOTAL POPULATION</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(0, 245, 255, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users style={{ width: 13, height: 13, color: "#00F5FF" }} />
            </div>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF", letterSpacing: "-0.02em" }}>2,45,80,146</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 10, fontWeight: 700, color: "#10B981" }}>
            <span>▲ 1.25%</span>
          </div>
          <div style={{ height: 24, marginTop: 6 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:10},{v:15},{v:12},{v:18},{v:22},{v:25}]}>
                <Area type="monotone" dataKey="v" stroke="#00F5FF" fill="rgba(0, 245, 255, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 2: Live Traffic Index */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(251, 191, 36, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>LIVE TRAFFIC INDEX</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(251, 191, 36, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Car style={{ width: 13, height: 13, color: "#FBBF24" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>63</span>
            <span style={{ fontSize: 10, color: "#64748B" }}>/ 100</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#FBBF24", background: "rgba(251, 191, 36, 0.15)", padding: "2px 6px", borderRadius: 4 }}>Moderate</span>
          </div>
          <div style={{ height: 24, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:40},{v:55},{v:50},{v:68},{v:60},{v:63}]}>
                <Area type="monotone" dataKey="v" stroke="#FBBF24" fill="rgba(251, 191, 36, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 3: Air Quality Index */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(52, 211, 153, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>AIR QUALITY INDEX</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(52, 211, 153, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Leaf style={{ width: 13, height: 13, color: "#34D399" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>42</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#34D399", background: "rgba(52, 211, 153, 0.15)", padding: "2px 6px", borderRadius: 4 }}>Good</span>
          </div>
          <div style={{ height: 24, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:60},{v:52},{v:48},{v:44},{v:40},{v:42}]}>
                <Area type="monotone" dataKey="v" stroke="#34D399" fill="rgba(52, 211, 153, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 4: Energy Consumption */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(249, 115, 22, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>ENERGY CONSUMPTION</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(249, 115, 22, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap style={{ width: 13, height: 13, color: "#F97316" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>128.5 MW</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#F97316" }}>▼ 4.32%</span>
          </div>
          <div style={{ height: 24, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:145},{v:140},{v:138},{v:132},{v:130},{v:128.5}]}>
                <Area type="monotone" dataKey="v" stroke="#F97316" fill="rgba(249, 115, 22, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 5: Water Supply Status */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>WATER SUPPLY STATUS</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(56, 189, 248, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Droplet style={{ width: 13, height: 13, color: "#38BDF8" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>98.6%</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#38BDF8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: 4 }}>Optimal</span>
          </div>
          <div style={{ height: 24, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:92},{v:95},{v:94},{v:97},{v:98},{v:98.6}]}>
                <Area type="monotone" dataKey="v" stroke="#38BDF8" fill="rgba(56, 189, 248, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Card 6: City Health Score */}
        <div className="nx-glass" style={{ background: "rgba(13, 20, 38, 0.75)", border: "1px solid rgba(168, 85, 247, 0.2)", borderRadius: 12, padding: "12px 14px", position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: "#94A3B8", letterSpacing: "0.05em" }}>CITY HEALTH SCORE</span>
            <div style={{ width: 26, height: 26, borderRadius: 8, background: "rgba(168, 85, 247, 0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <HeartPulse style={{ width: 13, height: 13, color: "#A855F7" }} />
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: "#FFFFFF" }}>87</span>
            <span style={{ fontSize: 10, color: "#64748B" }}>/ 100</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: "#A855F7", background: "rgba(168, 85, 247, 0.15)", padding: "2px 6px", borderRadius: 4 }}>Excellent</span>
          </div>
          <div style={{ height: 24, marginTop: 10 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={[{v:75},{v:80},{v:82},{v:85},{v:86},{v:87}]}>
                <Area type="monotone" dataKey="v" stroke="#A855F7" fill="rgba(168, 85, 247, 0.15)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ─── 3. MIDDLE SECTION: 3D CITY OVERVIEW + SIDEBAR PANELS ───────── */}
      <div style={{ display: "grid", gridTemplateColumns: "2.3fr 1fr", gap: 14, minHeight: 490 }}>
        
        {/* Left Main Card: 3D City View */}
        <div className="nx-glass" style={{
          position: "relative", background: "rgba(10, 16, 32, 0.85)",
          border: "1px solid rgba(0, 245, 255, 0.15)", borderRadius: 14,
          overflow: "hidden", display: "flex", flexDirection: "column"
        }}>
          {/* Card Header */}
          <div style={{
            padding: "12px 18px", borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.4)", zIndex: 10
          }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: "#F8FAFC", letterSpacing: "0.05em" }}>3D CITY OVERVIEW</div>
              <div style={{ fontSize: 10, color: "#64748B" }}>Real-time unified view of city operations</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={() => setCameraAutoRotate(!cameraAutoRotate)} style={{
                padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(0, 245, 255, 0.3)",
                background: cameraAutoRotate ? "rgba(0, 245, 255, 0.15)" : "transparent",
                color: cameraAutoRotate ? "#00F5FF" : "#94A3B8", fontSize: 10, fontWeight: 600, cursor: "pointer"
              }}>
                <RotateCw style={{ width: 11, height: 11, display: "inline-block", marginRight: 4 }} />
                {cameraAutoRotate ? "Orbiting" : "Orbit View"}
              </button>
            </div>
          </div>

          {/* 3D Canvas Container */}
          <div style={{ position: "relative", flex: 1, minHeight: 410 }}>
            <Canvas shadows camera={{ position: [12, 14, 18], fov: 42 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
              <City3DScene
                currentCity={currentCity} stylePreset={stylePreset} weather={weather} timeOfDay={timeOfDay}
                buildings={buildings} roads={roads} parks={parks} waters={waters} selectedBld={selectedBld}
                onSelectBld={inspectBuilding} onSelectVehicle={inspectVehicle} selectedVehicle={selectedVehicle}
                sirenActive={sirenActive} blackoutActive={blackoutActive} blackoutWaveRadius={blackoutWaveRadius}
                blackoutOrigin={blackoutOrigin} scanActive={scanActive} scanOffset={scanOffset}
                emergencyTarget={emergencyTarget} congestionMode={congestionMode} customSatelliteUrl={customSatelliteUrl}
                cameraAutoRotate={cameraAutoRotate} mapTargetPos={mapTargetPos} showLandmarks={showLayers.landmarks}
                showBuildings={showLayers.buildings} showRoads={showLayers.roads} showMetro={showLayers.metro}
                showTraffic={showLayers.traffic} showWater={showLayers.water} showGreen={showLayers.green}
                is2D={is2D} zoomInCounter={zoomInCounter} zoomOutCounter={zoomOutCounter}
                lightningActive={lightningActive} textureLoader={textureLoader}
              />
            </Canvas>

            {/* 3D Holographic Marker Pins */}
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 5 }}>
              {[
                { label: "TRAFFIC CAMERAS", val: "248 Online", color: "#00F5FF", icon: Camera, top: "22%", left: "28%" },
                { label: "ENERGY PLANTS", val: "12 Active", color: "#FBBF24", icon: Zap, top: "16%", left: "46%" },
                { label: "AIR QUALITY", val: "Good", color: "#34D399", icon: Leaf, top: "14%", left: "54%" },
                { label: "HOSPITALS", val: "24 Operational", color: "#EF4444", icon: Hospital, top: "30%", left: "68%" },
                { label: "POLICE STATIONS", val: "18 Active", color: "#3B82F6", icon: Shield, top: "44%", left: "64%" },
                { label: "FIRE STATIONS", val: "14 Active", color: "#F97316", icon: Flame, top: "56%", left: "60%" },
                { label: "WASTE PLANTS", val: "8 Active", color: "#10B981", icon: Trash2, top: "60%", left: "48%" },
                { label: "WATER TANKS", val: "95% Full", color: "#38BDF8", icon: Droplet, top: "48%", left: "30%" }
              ].map((pin, idx) => (
                <div key={idx} style={{
                  position: "absolute", top: pin.top, left: pin.left,
                  pointerEvents: "auto", cursor: "pointer"
                }}>
                  <div style={{
                    background: "rgba(10, 18, 40, 0.88)", border: `1px solid ${pin.color}88`,
                    borderRadius: 20, padding: "4px 10px 4px 6px", display: "flex", alignItems: "center", gap: 6,
                    boxShadow: `0 0 16px ${pin.color}40`, backdropFilter: "blur(10px)"
                  }}>
                    <div style={{ width: 20, height: 20, borderRadius: "50%", background: `${pin.color}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <pin.icon style={{ width: 11, height: 11, color: pin.color }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 8.5, fontWeight: 800, color: "#E2E8F0", letterSpacing: "0.04em" }}>{pin.label}</div>
                      <div style={{ fontSize: 8, color: pin.color, fontWeight: 700 }}>{pin.val}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            </div>
          </div>
        </div>


      
      {/* ✦ High-Performance Direct DOM Tooltip */}
      <div id="city-hud-tooltip" style={{
        position: "fixed",
        display: "none",
        zIndex: 10000,
        pointerEvents: "none",
        background: "rgba(6,10,24,0.94)",
        backdropFilter: "blur(12px)",
        border: "1.5px solid #00F5FF",
        borderRadius: 10,
        padding: "10px 14px",
        width: 220,
        fontFamily: "monospace",
        fontSize: "10.5px",
        color: "#E2E8F0",
        boxShadow: "0 12px 30px rgba(0,0,0,0.65)"
      }} />
    </div>
  );
}
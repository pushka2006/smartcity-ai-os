import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

function NeuralCore({ state = "idle" }) {
  const meshRef = useRef();
  const ringRef = useRef();
  const innerRef = useRef();
  const particlesRef = useRef();
  const eyeLRef = useRef();
  const eyeRRef = useRef();

  const stateColor = useMemo(() => {
    const map = {
      idle: new THREE.Color("#00F5FF"),
      thinking: new THREE.Color("#6E56FF"),
      speaking: new THREE.Color("#FF2E88"),
      listening: new THREE.Color("#00FF88"),
      executing: new THREE.Color("#FFC857"),
    };
    return map[state] || map.idle;
  }, [state]);

  const particleGeo = useMemo(() => {
    const count = 900;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const r = 1.7 + Math.random() * 0.9;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, []);

  useFrame(({ clock, mouse }) => {
    const t = clock.getElapsedTime();
    const speed = state === "thinking" ? 0.6 : state === "speaking" ? 0.8 : 0.25;
    if (meshRef.current) {
      meshRef.current.rotation.y = t * 0.18 + mouse.x * 0.0015;
      meshRef.current.rotation.x = Math.sin(t * 0.35) * 0.12 - mouse.y * 0.0015;
      const breathe = 1 + Math.sin(t * 1.6) * 0.025;
      meshRef.current.scale.setScalar(breathe);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.5 * speed;
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.4) * 0.1;
    }
    if (innerRef.current) {
      innerRef.current.rotation.y = -t * 0.4;
      innerRef.current.rotation.z = t * 0.25;
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = t * 0.06;
      particlesRef.current.rotation.x = t * 0.03;
    }
    const pulse = 0.7 + Math.abs(Math.sin(t * (state === "speaking" ? 6 : 2))) * 0.3;
    if (eyeLRef.current) eyeLRef.current.material.opacity = pulse;
    if (eyeRRef.current) eyeRRef.current.material.opacity = pulse;
  });

  return (
    <group>
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.55, 4]} />
        <meshBasicMaterial color={stateColor} wireframe transparent opacity={0.55} />
      </mesh>
      <mesh ref={innerRef}>
        <icosahedronGeometry args={[1.05, 2]} />
        <meshBasicMaterial color={stateColor} wireframe transparent opacity={0.18} />
      </mesh>
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.05, 0.012, 16, 200]} />
        <meshBasicMaterial color="#00F5FF" transparent opacity={0.55} />
      </mesh>
      <mesh rotation={[Math.PI / 3, Math.PI / 5, 0]}>
        <torusGeometry args={[2.25, 0.006, 12, 200]} />
        <meshBasicMaterial color="#FF2E88" transparent opacity={0.38} />
      </mesh>
      <mesh ref={eyeLRef} position={[-0.34, 0.18, 1.45]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#00F5FF" transparent opacity={1} />
      </mesh>
      <mesh ref={eyeRRef} position={[0.34, 0.18, 1.45]}>
        <sphereGeometry args={[0.07, 16, 16]} />
        <meshBasicMaterial color="#00F5FF" transparent opacity={1} />
      </mesh>
      <points ref={particlesRef} geometry={particleGeo}>
        <pointsMaterial size={0.018} color={stateColor} transparent opacity={0.85} sizeAttenuation />
      </points>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={1.2} color="#00F5FF" />
      <pointLight position={[-4, -2, 2]} intensity={0.6} color="#FF2E88" />
    </group>
  );
}

export default function AIFace({ state = "idle", className = "" }) {
  return (
    <div className={`relative w-full h-full ${className}`} data-testid="ai-face-canvas">
      <Canvas camera={{ position: [0, 0, 4.6], fov: 50 }} dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
        <NeuralCore state={state} />
      </Canvas>
      <div className="pointer-events-none absolute inset-0">
        <div style={{ position: "absolute", top: 12, left: 12 }} className="hud-label">NEXUS · CORE</div>
        <div style={{ position: "absolute", top: 12, right: 12 }} className="hud-label">v1.0.0</div>
        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between" }}>
          <span className="hud-label">{state.toUpperCase()}</span>
          <span className="hud-label nx-blink">●</span>
        </div>
      </div>

    </div>
  );
}

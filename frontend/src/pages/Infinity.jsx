import React from "react";
import InfiniteMenu from "../components/ui/InfiniteMenu";

const items = [
  {
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
    link: '/',
    title: 'COMMAND',
    description: 'Central operations console'
  },
  {
    image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=600&q=80',
    link: '/3dcity',
    title: '3D CITY',
    description: 'Delhi digital twin twin'
  },
  {
    image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=600&q=80',
    link: '/chat',
    title: 'AI CHAT',
    description: 'Speak with Assistant'
  },
  {
    image: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=600&q=80',
    link: '/agents',
    title: 'AI AGENTS',
    description: 'Multi-agent workspace'
  },
  {
    image: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=600&q=80',
    link: '/memory',
    title: 'MEMORY',
    description: 'Vectorized cognitive memory'
  },
  {
    image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?auto=format&fit=crop&w=600&q=80',
    link: '/knowledge',
    title: 'KNOWLEDGE',
    description: 'Semantic knowledge graphs'
  },
  {
    image: 'https://images.unsplash.com/photo-1542831371-29b0f74f9713?auto=format&fit=crop&w=600&q=80',
    link: '/code',
    title: 'CODE',
    description: 'Autonomous coding studio'
  },
  {
    image: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?auto=format&fit=crop&w=600&q=80',
    link: '/terminal',
    title: 'TERMINAL',
    description: 'Secure system shell'
  },
  {
    image: 'https://images.unsplash.com/photo-1545239351-ef35f43d514b?auto=format&fit=crop&w=600&q=80',
    link: '/browser',
    title: 'BROWSER',
    description: 'Secure isolated web browser'
  },
  {
    image: 'https://images.unsplash.com/photo-1484480974693-2cae859b3a42?auto=format&fit=crop&w=600&q=80',
    link: '/tasks',
    title: 'TASKS',
    description: 'Task orchestrator scheduler'
  },
  {
    image: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=600&q=80',
    link: '/monitor',
    title: 'MONITOR',
    description: 'Real-time node telemetry'
  },
  {
    image: 'https://images.unsplash.com/photo-1506015391300-4802dc74de2e?auto=format&fit=crop&w=600&q=80',
    link: '/camera',
    title: 'CAMERA',
    description: 'Surveillance video streams'
  },
  {
    image: 'https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?auto=format&fit=crop&w=600&q=80',
    link: '/traffic',
    title: 'TRAFFIC',
    description: 'Congestion flow models'
  },
  {
    image: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&w=600&q=80',
    link: '/urban',
    title: 'URBAN MAP',
    description: 'City GIS analytics map'
  },
  {
    image: 'https://images.unsplash.com/photo-1507608869274-d3177c8bb4c7?auto=format&fit=crop&w=600&q=80',
    link: '/particles',
    title: 'PARTICLES',
    description: 'Quantum flow simulations'
  },
  {
    image: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80',
    link: '/animate',
    title: 'ANIMATION',
    description: 'Keyframe curve designer'
  },
  {
    image: 'https://images.unsplash.com/photo-1531747118685-ca8fa6e08806?auto=format&fit=crop&w=600&q=80',
    link: '/handanim',
    title: 'GESTURES',
    description: 'Hand particle sensors'
  },
  {
    image: 'https://images.unsplash.com/photo-1535378917042-10a22c95931a?auto=format&fit=crop&w=600&q=80',
    link: '/hologram',
    title: 'HOLOGRAM',
    description: 'Quantum hologram visuals'
  },
  {
    image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80',
    link: '/virtualface',
    title: 'AVATAR',
    description: 'Virtual avatar interface'
  },
  {
    image: 'https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=600&q=80',
    link: '/ui-playground',
    title: 'NEXUS UI',
    description: 'Component style guide'
  },
  {
    image: 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=600&q=80',
    link: '/biometrics',
    title: 'SECURITY',
    description: 'Bio-signature firewall'
  },
  {
    image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=600&q=80',
    link: '/settings',
    title: 'SETTINGS',
    description: 'System configuration dashboard'
  }
];

export default function InfinityPage() {
  const [dims, setDims] = React.useState({ w: 0, h: 0 });

  React.useEffect(() => {
    const check = () => {
      const canvas = document.getElementById("infinite-grid-menu-canvas");
      if (canvas) {
        setDims({ w: canvas.clientWidth, h: canvas.clientHeight });
      }
    };
    check();
    const interval = setInterval(check, 300);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ width: "100%", height: "calc(100vh - 60px)", minHeight: 600, display: "flex", flexDirection: "column", position: "relative" }} className="nx-fadein">
      {/* Title block */}
      <div style={{ position: "absolute", top: 16, left: 24, zIndex: 10, pointerEvents: "none" }}>
        <h1 className="font-display text-white" style={{ fontSize: 22, fontWeight: 800, margin: 0, textTransform: "uppercase", letterSpacing: "0.08em", textShadow: "0 0 10px rgba(0,0,0,0.8)" }}>
          Nexus Infinity Console {dims.w > 0 ? `(${dims.w}x${dims.h})` : ''}
        </h1>
        <p style={{ fontSize: 12, color: "#94A3B8", margin: "4px 0 0", fontWeight: 500, letterSpacing: "0.02em", textShadow: "0 0 8px rgba(0,0,0,0.8)" }}>
          Infinite 3D Quantum Interface
        </p>
      </div>

      <div style={{ flex: 1, width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#020617", borderRadius: 16, border: "1px solid rgba(0, 245, 255, 0.12)", boxShadow: "0 0 30px rgba(0, 245, 255, 0.05)" }}>
        <InfiniteMenu items={items} scale={1.0} />
      </div>
    </div>
  );
}

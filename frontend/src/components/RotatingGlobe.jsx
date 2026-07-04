import { useEffect, useRef } from "react";

export default function RotatingGlobe({ color = "#00f5ff" }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let time = 0;

    const points = [];
    const numPoints = 220;
    const radius = 0.85;

    // Generate coordinates on a sphere
    for (let i = 0; i < numPoints; i++) {
      const theta = Math.acos(-1 + (2 * i) / numPoints);
      const phi = Math.sqrt(numPoints * Math.PI) * theta;
      const x = Math.sin(theta) * Math.cos(phi) * radius;
      const y = Math.sin(theta) * Math.sin(phi) * radius;
      const z = Math.cos(theta) * radius;
      points.push({ x, y, z });
    }

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const w = canvas.width;
      const h = canvas.height;
      const cX = w / 2;
      const cY = h / 2;
      const scale = Math.min(w, h) * 0.42;

      time += 0.015;

      // Rotation angles
      const rotY = time;
      const rotX = 0.35;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Project and draw particles
      const projected = points.map((p) => {
        // Rotate Y
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;

        // Rotate X
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        // Simple perspective projection
        const cameraD = 2.0;
        const divisor = z2 + cameraD;
        const px = (x1 * scale) / divisor + cX;
        const py = (-y2 * scale) / divisor + cY;

        return { x: px, y: py, depth: z2 };
      });

      // Draw grid wireframes
      ctx.strokeStyle = `${color}0d`;
      ctx.lineWidth = 0.5;
      projected.forEach((p, idx) => {
        // Connect to nearest neighbor for wireframe web effect
        const next = projected[(idx + 1) % numPoints];
        if (p.depth < 0.2 && next.depth < 0.2) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(next.x, next.y);
          ctx.stroke();
        }
      });

      // Draw particles
      projected.forEach((p) => {
        // Cull back-face particles slightly to give depth
        const alpha = Math.max(0.08, 0.65 - p.depth * 0.35);
        ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.depth < 0 ? 1.8 : 1.1, 0, Math.PI * 2);
        ctx.fill();

        // Extra glowing node on front
        if (p.depth < -0.6) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 4;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = `${color}dd`;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      // Outer orbit rings
      ctx.strokeStyle = `${color}1a`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(cX, cY, scale * 1.15, scale * 0.3, Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animationFrameId);
  }, [color]);

  return (
    <div style={{ width: "100%", height: 110, display: "flex", justifyContent: "center", alignItems: "center", position: "relative" }}>
      <canvas ref={canvasRef} width={200} height={110} style={{ width: 200, height: 110 }} />
    </div>
  );
}

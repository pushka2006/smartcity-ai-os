import { useEffect, useRef } from "react";

export default function ParticleBackground({
  color = "#00F5FF",
  count = 70,
  speed = 0.8,
  interactive = true,
  interactiveMode = "magnet", // 'magnet' | 'repel' | 'grab'
  connectionLines = true,
  lineDistance = 110,
  fullscreen = false,
  className = "",
  style = {},
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId;
    let particles = [];
    const mouse = { x: null, y: null, active: false };

    // Get parent bounds
    const resizeCanvas = () => {
      if (fullscreen) {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
      } else {
        const parent = containerRef.current?.parentElement;
        if (parent) {
          canvas.width = parent.clientWidth;
          canvas.height = parent.clientHeight;
        } else {
          canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
          canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
        }
      }
      initParticles();
    };

    class Particle {
      constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 1.8 + 1.2; // radius between 1.2 and 3.0
        // Random directions
        this.vx = (Math.random() - 0.5) * speed;
        this.vy = (Math.random() - 0.5) * speed;
        this.baseVx = this.vx;
        this.baseVy = this.vy;
        this.opacity = Math.random() * 0.5 + 0.35;
      }

      update() {
        // Move particle
        this.x += this.vx;
        this.y += this.vy;

        // Bounce or wrap edges
        if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas.height) this.vy *= -1;

        // Boundary safety
        if (this.x < 0) this.x = 0;
        if (this.x > canvas.width) this.x = canvas.width;
        if (this.y < 0) this.y = 0;
        if (this.y > canvas.height) this.y = canvas.height;

        // Mouse interaction
        if (interactive && mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const distance = Math.hypot(dx, dy);
          const forceRadius = 160;

          if (distance < forceRadius) {
            const force = (forceRadius - distance) / forceRadius; // 0 to 1

            if (interactiveMode === "magnet") {
              // Pull towards mouse
              const pullStrength = 0.05 * force;
              this.vx += (dx / distance) * pullStrength;
              this.vy += (dy / distance) * pullStrength;
            } else if (interactiveMode === "repel") {
              // Push away from mouse
              const pushStrength = 0.4 * force;
              this.vx -= (dx / distance) * pushStrength;
              this.vy -= (dy / distance) * pushStrength;
            }
          } else {
            // Gradually return to base speed/velocity
            this.vx += (this.baseVx - this.vx) * 0.03;
            this.vy += (this.baseVy - this.vy) * 0.03;
          }
        } else {
          this.vx += (this.baseVx - this.vx) * 0.02;
          this.vy += (this.baseVy - this.vy) * 0.02;
        }

        // Limit speed to prevent runaway speed
        const currentSpeed = Math.hypot(this.vx, this.vy);
        const maxAllowedSpeed = Math.max(speed * 3, 2.5);
        if (currentSpeed > maxAllowedSpeed) {
          this.vx = (this.vx / currentSpeed) * maxAllowedSpeed;
          this.vy = (this.vy / currentSpeed) * maxAllowedSpeed;
        }
      }

      draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.globalAlpha = this.opacity;
        ctx.fill();
      }
    }

    const initParticles = () => {
      particles = [];
      const actualCount = Math.floor(
        Math.min(count, (canvas.width * canvas.height) / 8000)
      ); // Cap density to maintain performance
      for (let i = 0; i < actualCount; i++) {
        particles.push(new Particle());
      }
    };

    const drawLines = () => {
      if (!connectionLines) return;
      ctx.globalAlpha = 1;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.hypot(dx, dy);

          if (dist < lineDistance) {
            // Compute opacity based on distance (fades out as it gets further)
            const alpha = (1 - dist / lineDistance) * 0.16;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = color;
            ctx.globalAlpha = alpha;
            ctx.lineWidth = 0.8;
            ctx.stroke();
          }
        }
      }
    };

    const drawMouseGrabLines = () => {
      if (interactiveMode !== "grab" || !mouse.active || mouse.x === null || mouse.y === null) return;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 150) {
          const alpha = (1 - dist / 150) * 0.35;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = color;
          ctx.globalAlpha = alpha;
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      // Draw connections
      drawLines();
      drawMouseGrabLines();

      animationFrameId = requestAnimationFrame(animate);
    };

    // Event handlers
    const handleMouseMove = (e) => {
      if (!interactive) return;
      mouse.active = true;
      if (fullscreen) {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
      } else {
        const rect = canvas.getBoundingClientRect();
        mouse.x = e.clientX - rect.left;
        mouse.y = e.clientY - rect.top;
      }
    };

    const handleMouseLeave = () => {
      mouse.active = false;
      mouse.x = null;
      mouse.y = null;
    };

    const handleTouchMove = (e) => {
      if (!interactive || e.touches.length === 0) return;
      mouse.active = true;
      const touch = e.touches[0];
      if (fullscreen) {
        mouse.x = touch.clientX;
        mouse.y = touch.clientY;
      } else {
        const rect = canvas.getBoundingClientRect();
        mouse.x = touch.clientX - rect.left;
        mouse.y = touch.clientY - rect.top;
      }
    };

    // Setup listeners
    const targetElement = fullscreen ? window : canvas.parentElement || canvas;

    targetElement.addEventListener("mousemove", handleMouseMove);
    targetElement.addEventListener("mouseleave", handleMouseLeave);
    targetElement.addEventListener("touchmove", handleTouchMove, { passive: true });
    targetElement.addEventListener("touchend", handleMouseLeave);
    window.addEventListener("resize", resizeCanvas);

    // Run
    resizeCanvas();
    animate();

    // Clean up
    return () => {
      cancelAnimationFrame(animationFrameId);
      targetElement.removeEventListener("mousemove", handleMouseMove);
      targetElement.removeEventListener("mouseleave", handleMouseLeave);
      targetElement.removeEventListener("touchmove", handleTouchMove);
      targetElement.removeEventListener("touchend", handleMouseLeave);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [color, count, speed, interactive, interactiveMode, connectionLines, lineDistance, fullscreen]);

  const wrapperStyle = fullscreen
    ? {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        ...style,
      }
    : {
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        zIndex: 0,
        pointerEvents: "none",
        ...style,
      };

  return (
    <div
      ref={containerRef}
      style={wrapperStyle}
      className={`nx-particles-wrapper ${className}`}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
        }}
      />
    </div>
  );
}

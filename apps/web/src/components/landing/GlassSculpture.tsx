"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useMotionPref } from "../layout/MotionPrefs";
import { FRAG, VERT } from "./glassShader";

/**
 * WebGL hero sculpture. Renders at a reduced internal resolution for speed,
 * pauses when off-screen or when the tab is hidden, follows the pointer, and
 * ripples on click. With animations off it renders a single still frame.
 * Falls back to a CSS glass orb if WebGL is unavailable.
 */
export function GlassSculpture({ className, onReady }: { className?: string; onReady?: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const { animate } = useMotionPref();
  const animateRef = useRef(animate);
  const pulseRef = useRef(0);
  const scheduleRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "high-performance" });
    if (!gl) {
      setFailed(true);
      return;
    }

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("[GlassSculpture]", gl.getShaderInfoLog(s));
        return null;
      }
      return s;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      setFailed(true);
      return;
    }
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      setFailed(true);
      return;
    }
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const u = {
      res: gl.getUniformLocation(prog, "uRes"),
      time: gl.getUniformLocation(prog, "uTime"),
      mouse: gl.getUniformLocation(prog, "uMouse"),
      pulse: gl.getUniformLocation(prog, "uPulse"),
      offset: gl.getUniformLocation(prog, "uOffset"),
      scale: gl.getUniformLocation(prog, "uScale"),
    };

    let w = 0;
    let h = 0;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      // Raymarching is per-pixel: render below native resolution and let CSS upscale.
      const quality = rect.width < 700 ? 0.6 : 0.75;
      w = Math.max(1, Math.round(rect.width * dpr * quality));
      h = Math.max(1, Math.round(rect.height * dpr * quality));
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      gl.uniform2f(u.res, w, h);
      const aspect = rect.width / Math.max(rect.height, 1);
      // Visible half-width at the sculpture's depth (camera z = 6, focal 1.75).
      const halfW = (aspect / 2) * (6.0 / 1.75);
      if (aspect > 1.15) {
        // Desktop: sculpture sits in the right half, fully in frame.
        const scale = Math.min(1.05, Math.max(0.7, halfW * 0.34));
        gl.uniform2f(u.offset, halfW * 0.5, -0.05);
        gl.uniform1f(u.scale, scale);
      } else {
        // Mobile/tablet portrait: centred, lower, smaller, behind the copy.
        gl.uniform2f(u.offset, -0.2, -0.55);
        gl.uniform1f(u.scale, Math.max(0.55, halfW * 0.48));
      }
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // pointer tracking (whole window, so the sculpture reacts across the hero)
    const target = { x: 0, y: 0 };
    const mouse = { x: 0, y: 0 };
    const onMove = (e: PointerEvent) => {
      target.x = (e.clientX / window.innerWidth) * 2 - 1;
      target.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });

    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    });
    io.observe(canvas);

    let raf = 0;
    let last = performance.now();
    let time = 4.0;
    let first = true;

    const frame = (now: number) => {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const anim = animateRef.current;
      if (anim) time += dt;
      mouse.x += (target.x - mouse.x) * Math.min(1, dt * 3.5);
      mouse.y += (target.y - mouse.y) * Math.min(1, dt * 3.5);
      pulseRef.current = Math.max(0, pulseRef.current - dt * 0.7);

      gl.uniform1f(u.time, time);
      gl.uniform2f(u.mouse, anim ? mouse.x : 0, anim ? mouse.y : 0);
      gl.uniform1f(u.pulse, anim ? pulseRef.current : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      if (first) {
        first = false;
        setReady(true);
        onReady?.();
      }
      if (anim) schedule();
    };
    const schedule = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };
    const onVis = () => {
      last = performance.now();
      schedule();
    };
    document.addEventListener("visibilitychange", onVis);
    scheduleRef.current = () => {
      last = performance.now();
      schedule();
    };
    // still-frame mode re-renders on resize/pointer only
    const onAny = () => {
      if (!animateRef.current) schedule();
    };
    window.addEventListener("resize", onAny);
    schedule();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", onAny);
      document.removeEventListener("visibilitychange", onVis);
      // Free GPU resources but keep the context alive: React Strict Mode re-runs
      // this effect on the same canvas, and a lost context can't compile shaders.
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep the render loop in sync with the motion preference
  useEffect(() => {
    animateRef.current = animate;
    scheduleRef.current?.();
  }, [animate]);

  return (
    <div className={cn("absolute inset-0", className)}>
      {!failed ? (
        <canvas
          ref={canvasRef}
          onPointerDown={() => {
            pulseRef.current = 1;
          }}
          aria-hidden
          className={cn(
            "h-full w-full cursor-pointer transition-opacity duration-[1200ms] ease-out",
            ready ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <CssOrbFallback />
      )}
    </div>
  );
}

function CssOrbFallback() {
  return (
    <div aria-hidden className="absolute inset-0 overflow-hidden">
      <div className="absolute right-[8%] top-1/2 size-[min(46vw,30rem)] -translate-y-1/2 animate-float rounded-[46%_54%_52%_48%/55%_48%_52%_45%] bg-[radial-gradient(circle_at_30%_25%,rgb(255_255_255/0.5),rgb(157_143_255/0.18)_30%,rgb(10_12_20/0.9)_70%)] shadow-[inset_0_0_60px_rgb(157_143_255/0.35),inset_-20px_-30px_60px_rgb(92_225_230/0.25),0_40px_80px_-20px_rgb(0_0_0/0.8)]" />
      <div className="absolute right-0 top-0 h-full w-1/2 bg-[linear-gradient(215deg,rgb(255_255_255/0.14),transparent_45%)] blur-2xl" />
    </div>
  );
}

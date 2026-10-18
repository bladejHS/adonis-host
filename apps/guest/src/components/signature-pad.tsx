"use client";

import { useEffect, useRef, useState } from "react";

/** Semnătură cu degetul sau mouse-ul. Întoarce un PNG (data URL) sau null când e gol. */
export function SignaturePad({ onChange }: { onChange: (png: string | null) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const strokes = useRef(0);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = c.getBoundingClientRect();
    c.width = width * ratio;
    c.height = height * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0b2230";
  }, []);

  const point = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    strokes.current++;
  };
  const end = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (strokes.current > 8) {
      setEmpty(false);
      onChange(canvas.current!.toDataURL("image/png"));
    }
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    strokes.current = 0;
    setEmpty(true);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="relative rounded border border-line-strong bg-white">
        <canvas
          ref={canvas}
          className="block h-44 w-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label="Chenar pentru semnătură"
        />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-display text-xl italic text-ivory-400">Semnați aici</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 h-px bg-line" />
      </div>
      <button type="button" onClick={clear} className="text-xs text-gold-text underline underline-offset-4">
        Șterge și semnează din nou
      </button>
    </div>
  );
}

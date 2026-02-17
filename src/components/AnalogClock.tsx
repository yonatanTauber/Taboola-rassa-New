"use client";

import { useEffect, useState } from "react";

export function AnalogClock({ compact = false }: { compact?: boolean }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  if (!now) {
    const size = compact ? 42 : 52;
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="rounded-full border border-black/10 bg-white/80" style={{ width: size, height: size }} />
        <div className="font-mono text-[10px] text-muted">--:--</div>
      </div>
    );
  }

  const secondDeg = now.getSeconds() * 6;
  const minuteDeg = now.getMinutes() * 6 + now.getSeconds() * 0.1;
  const hourDeg = (now.getHours() % 12) * 30 + now.getMinutes() * 0.5;

  const size = compact ? 42 : 52;

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative rounded-full border border-black/10 bg-white/80"
        style={{ width: size, height: size }}
      >
        <ClockHand deg={hourDeg} length={compact ? 14 : 18} width={2.4} />
        <ClockHand deg={minuteDeg} length={compact ? 18 : 24} width={1.8} />
        <ClockHand deg={secondDeg} length={compact ? 15 : 20} width={1.1} color="var(--danger)" />
        <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink" />
      </div>
      <div className="font-mono text-[10px] text-muted">{now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</div>
    </div>
  );
}

function ClockHand({ deg, length, width, color = "var(--ink)" }: { deg: number; length: number; width: number; color?: string }) {
  return (
    <span
      className="absolute origin-bottom rounded-full"
      style={{
        height: `${length}px`,
        width: `${width}px`,
        backgroundColor: color,
        left: "50%",
        bottom: "50%",
        transform: `translateX(-50%) rotate(${deg}deg)`,
      }}
    />
  );
}

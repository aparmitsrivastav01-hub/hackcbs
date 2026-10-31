export function HeroDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-visible" aria-hidden>
      {/* Soft radial blue glow */}
      <div className="absolute h-[700px] w-[700px] rounded-full bg-[radial-gradient(circle_at_center,#d6e9ff_0%,#eef6ff_46%,rgba(255,255,255,0)_72%)]" />

      {/* Large Medical Cross (+) centered directly behind phone */}
      <div className="absolute z-0 hidden text-[#cbe2fe] lg:block">
        {/* Horizontal bar */}
        <div className="absolute left-1/2 top-1/2 h-[116px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-[36px] bg-current" />
        {/* Vertical bar */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[116px] -translate-x-1/2 -translate-y-1/2 rounded-[36px] bg-current" />
      </div>

      {/* 3D Blue & White Capsule Pill - positioned at bottom-left */}
      <div className="absolute -left-7 bottom-[86px] z-20 hidden lg:block">
        <Capsule3D />
      </div>

      {/* 3D Round White Scored Tablet Pill - positioned at bottom-right under comparison card */}
      <div className="absolute -right-8 -bottom-3 z-20 hidden lg:block">
        <Tablet3D />
      </div>
    </div>
  );
}

export function Capsule3D() {
  return (
    <div
      className="relative h-[34px] w-[78px] overflow-hidden rounded-full shadow-[0_16px_32px_rgba(8,102,255,0.36),0_4px_12px_rgba(15,35,80,0.16)] ring-1 ring-white/80"
      style={{ transform: "rotate(-32deg)" }}
    >
      {/* Left blue half */}
      <div className="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-b from-[#3b82f6] via-[#0866FF] to-[#004fc4]" />
      {/* Right white half */}
      <div className="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-b from-white via-[#f8fafc] to-[#dbe4ef]" />
      {/* Center divider seam */}
      <div className="absolute inset-y-0 left-1/2 w-[1.5px] -translate-x-1/2 bg-white/60 shadow-[0_0_2px_rgba(0,0,0,0.1)]" />
      {/* Top 3D glossy highlight */}
      <div className="absolute left-3 top-1.5 h-2 w-[68%] rounded-full bg-gradient-to-b from-white/90 to-transparent blur-[0.3px]" />
      {/* Bottom ambient shadow */}
      <div className="absolute inset-x-0 bottom-0 h-2 bg-gradient-to-t from-black/20 to-transparent" />
    </div>
  );
}

export function Tablet3D() {
  return (
    <div
      className="relative h-12 w-12 rounded-full bg-gradient-to-br from-white via-[#f8fafc] to-[#cbd5e1] shadow-[0_14px_28px_rgba(15,35,80,0.2),0_3px_6px_rgba(0,0,0,0.08)] ring-1 ring-white/90"
      style={{ transform: "rotate(-14deg)" }}
    >
      {/* Beveled edge inner circle */}
      <div className="absolute inset-[2.5px] rounded-full border border-white/90 bg-gradient-to-br from-white via-[#f1f5f9] to-[#d8e2ee]" />
      {/* Center score groove line */}
      <div className="absolute left-1/2 top-1/2 h-[24px] w-[1.5px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300 shadow-[inset_0_1px_1px_rgba(0,0,0,0.15)]" />
      {/* Top specular highlight reflection */}
      <div className="absolute left-2.5 top-2.5 h-3 w-3 rounded-full bg-white/95 blur-[0.4px]" />
    </div>
  );
}

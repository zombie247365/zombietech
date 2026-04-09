'use client';

interface StepDotsProps {
  total: number;
  current: number; // 0-based index of the current step
}

export function StepDots({ total, current }: StepDotsProps) {
  return (
    <div className="flex gap-1.5 mb-5">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 rounded-full transition-all ${
            i < current
              ? 'w-1.5 bg-[#a3d9bc]'
              : i === current
              ? 'w-5 bg-[#1d9e75]'
              : 'w-1.5 bg-[#e0e0e0]'
          }`}
        />
      ))}
    </div>
  );
}

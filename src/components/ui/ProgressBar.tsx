import React from 'react';

interface ProgressBarProps {
  label: string;
  current: number;
  target: number;
  colorClass: string; // ex: bg-cyan-500
  unit: string; // g ou kcal
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  label,
  current,
  target,
  colorClass,
  unit,
}) => {
  const isOver = current > target;
  const percentage = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  
  // Utiliser une couleur d'avertissement rouge si dépassement
  const barColor = isOver ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]' : colorClass;
  
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between items-baseline text-xs font-medium text-slate-400">
        <span className="font-display font-semibold text-slate-300">{label}</span>
        <span className="tabular-nums">
          <span className={`font-semibold ${isOver ? 'text-rose-400' : 'text-slate-100'}`}>
            {Math.round(current)}
          </span>
          <span className="text-slate-500"> / {Math.round(target)}{unit}</span>
        </span>
      </div>
      
      {/* Container de la barre */}
      <div className="h-2 w-full bg-zinc-800/80 rounded-full overflow-hidden relative">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

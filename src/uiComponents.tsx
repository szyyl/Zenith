import type {ReactNode} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {ChevronDown, ChevronRight} from 'lucide-react';

export function ScoreDetail({
  label,
  score,
  desc,
}: {
  label: string;
  score: number;
  desc: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-end">
        <span className="text-sm font-sans font-semibold text-slate-900">{label}</span>
        <span className="text-lg font-mono font-bold text-zenith-accent">{score}</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
        <motion.div
          initial={{width: 0}}
          animate={{width: `${score}%`}}
          transition={{duration: 1, ease: 'easeOut'}}
          className="h-full bg-zenith-accent"
        />
      </div>
      <p className="text-[10px] text-slate-500 leading-relaxed italic">{desc}</p>
    </div>
  );
}

export function RiskCell({
  label,
  level,
}: {
  label: string;
  level: 'low' | 'medium' | 'high';
}) {
  const colors = {
    low: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    medium: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    high: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className={`p-4 rounded-xl border ${colors[level]} text-center`}>
      <p className="text-[10px] uppercase font-bold tracking-widest mb-1">{label}</p>
      <p className="text-xs font-bold uppercase">{level}</p>
    </div>
  );
}

export function SidebarItem({
  icon,
  label,
  active,
  onClick,
  subItems,
  activeSubId,
  onSubClick,
  isExpanded,
  onToggleExpand,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
  subItems?: {id: string; label: string}[];
  activeSubId?: string;
  onSubClick?: (id: string) => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1 group">
        <button
          onClick={onClick}
          className={`flex-1 flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-500 relative overflow-hidden ${active ? 'nav-item-active' : 'text-slate-500 hover:text-slate-900'}`}
        >
          {active && (
            <motion.div
              layoutId="activeNav"
              className="absolute inset-0 bg-slate-100/70 backdrop-blur-xl border border-white/80 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.05)] rounded-2xl z-0 dark:bg-slate-800/80 dark:border-slate-700/50"
              transition={{type: 'spring', bounce: 0.2, duration: 0.6}}
            />
          )}
          <span className={`${active ? 'text-zenith-accent' : 'text-slate-400 group-hover:text-slate-900'} transition-colors relative z-10`}>
            {icon}
          </span>
          <span className="text-sm relative z-10">{label}</span>
          {active && (
            <motion.div
              initial={{scale: 0}}
              animate={{scale: 1}}
              className="w-1.5 h-1.5 rounded-full bg-zenith-accent ml-auto relative z-10 shadow-sm shadow-zenith-accent/40"
            />
          )}
        </button>

        {subItems && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand?.();
            }}
            className={`p-2 rounded-xl hover:bg-slate-100 transition-colors ${isExpanded ? 'text-zenith-accent' : 'text-slate-400'}`}
          >
            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && subItems && (
          <motion.div
            initial={{height: 0, opacity: 0}}
            animate={{height: 'auto', opacity: 1}}
            exit={{height: 0, opacity: 0}}
            className="overflow-hidden pl-14 space-y-1"
          >
            {subItems.map((item) => (
              <button
                key={item.id}
                onClick={() => onSubClick?.(item.id)}
                className={`w-full text-left py-2 text-xs transition-colors ${activeSubId === item.id ? 'text-zenith-accent font-bold' : 'text-slate-500 hover:text-slate-900'}`}
              >
                {item.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StatCard({
  label,
  value,
  trend,
  negative,
  tooltip,
}: {
  label: string;
  value: string;
  trend: string;
  negative?: boolean;
  tooltip?: string;
}) {
  return (
    <div className="glass-panel p-8 hover:bg-slate-50 transition-colors group">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-bold">{label}</p>
        {tooltip && (
          <div className="group/tooltip relative">
            <div className="w-3.5 h-3.5 rounded-full bg-slate-200 text-slate-500 flex items-center justify-center text-[8px] cursor-help font-bold hover:bg-slate-300 transition-colors">?</div>
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max px-3 py-1.5 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 pointer-events-none group-hover/tooltip:opacity-100 transition-opacity z-50 shadow-lg font-normal tracking-wide">
              {tooltip}
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-baseline justify-between">
        <h4 className="text-2xl font-sans font-bold text-slate-900">{value}</h4>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${trend === '稳定' ? 'bg-slate-100 text-slate-500' : (negative ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-600')}`}>
          {trend}
        </div>
      </div>
    </div>
  );
}

export function GtmMetricInput({
  label,
  description,
  value,
  onChange,
  icon,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  icon: ReactNode;
}) {
  return (
    <div className="space-y-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:bg-slate-100 transition-colors group">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs font-bold uppercase tracking-widest text-slate-700">{label}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-medium">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onChange(Math.max(0, value - 1))}
            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-zenith-accent hover:border-zenith-accent/30 transition-all shadow-sm active:scale-95"
          >
            <span className="text-lg leading-none mt-[-2px]">-</span>
          </button>
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseInt(e.target.value) || 0)}
            onFocus={(e) => e.target.select()}
            className="w-16 bg-white border border-slate-200 rounded-lg py-1 px-2 text-sm font-mono font-bold text-center text-slate-900 outline-none focus:border-zenith-accent/50 focus:ring-1 focus:ring-zenith-accent/10 transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            onClick={() => onChange(value + 1)}
            className="w-6 h-6 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-zenith-accent hover:border-zenith-accent/30 transition-all shadow-sm active:scale-95"
          >
            <span className="text-lg leading-none mt-[-2px]">+</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  change,
  trend = 'up',
}: {
  label: string;
  value: string;
  change: string;
  trend?: 'up' | 'down';
}) {
  return (
    <div className="glass-panel p-8 space-y-4">
      <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-500">{label}</p>
      <div className="flex items-end justify-between">
        <h4 className="text-2xl font-sans font-bold text-slate-900">{value}</h4>
        <div className={`flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-lg ${trend === 'up' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
          {trend === 'up' ? '↑' : '↓'} {change}
        </div>
      </div>
    </div>
  );
}

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface NetworkNodesProps {
  centerLabel: string;
  satellites: string[];
  className?: string;
  ariaLabel?: string;
}

const VIEW_BOX_W = 600;
const VIEW_BOX_H = 440;
const CENTER_X = VIEW_BOX_W / 2;
const CENTER_Y = 220;
const RADIUS = 160;

export function NetworkNodes({
  centerLabel,
  satellites,
  className,
  ariaLabel,
}: NetworkNodesProps) {
  const positions = satellites.slice(0, 6).map((label, i) => {
    const angle = ((-90 + i * 60) * Math.PI) / 180;
    return {
      label,
      x: CENTER_X + RADIUS * Math.cos(angle),
      y: CENTER_Y + RADIUS * Math.sin(angle),
    };
  });

  return (
    <div className={cn('mx-auto w-full max-w-3xl', className)}>
      <svg
        viewBox={`0 0 ${VIEW_BOX_W} ${VIEW_BOX_H}`}
        className="h-auto w-full"
        role="img"
        aria-label={ariaLabel ?? 'Ecosystem network'}
      >
        <defs>
          <radialGradient id="emilia-glow" cx="50%" cy="50%" r="50%">
            <stop
              offset="0%"
              stopColor="hsl(var(--primary))"
              stopOpacity="0.35"
            />
            <stop
              offset="100%"
              stopColor="hsl(var(--primary))"
              stopOpacity="0"
            />
          </radialGradient>
        </defs>

        {positions.map((pos, i) => (
          <motion.line
            key={`line-${pos.label}`}
            x1={CENTER_X}
            y1={CENTER_Y}
            x2={pos.x}
            y2={pos.y}
            stroke="hsl(var(--border))"
            strokeWidth="1"
            strokeDasharray="4 4"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: [0.2, 0.6, 0.2] }}
            viewport={{ once: false, amount: 0.3 }}
            transition={{
              duration: 2.4,
              repeat: Infinity,
              delay: i * 0.3,
              ease: 'easeInOut',
            }}
          />
        ))}

        <circle cx={CENTER_X} cy={CENTER_Y} r={70} fill="url(#emilia-glow)" />

        <motion.g
          initial={{ scale: 0.9, opacity: 0 }}
          whileInView={{ scale: 1, opacity: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          <circle cx={CENTER_X} cy={CENTER_Y} r={32} fill="hsl(var(--primary))" />
          <circle
            cx={CENTER_X}
            cy={CENTER_Y}
            r={32}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeOpacity="0.4"
          >
            <animate
              attributeName="r"
              values="32;46;32"
              dur="2.4s"
              repeatCount="indefinite"
            />
            <animate
              attributeName="stroke-opacity"
              values="0.4;0;0.4"
              dur="2.4s"
              repeatCount="indefinite"
            />
          </circle>
          <text
            x={CENTER_X}
            y={CENTER_Y + 4}
            textAnchor="middle"
            className="fill-primary-foreground text-xs font-semibold"
          >
            {centerLabel}
          </text>
        </motion.g>

        {positions.map((pos, i) => (
          <motion.g
            key={pos.label}
            initial={{ scale: 0, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{
              duration: 0.4,
              delay: 0.2 + i * 0.08,
              ease: 'easeOut',
            }}
          >
            <circle
              cx={pos.x}
              cy={pos.y}
              r={20}
              fill="hsl(var(--background))"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
            />
            <circle cx={pos.x} cy={pos.y} r={6} fill="hsl(var(--primary))" />
            <text
              x={pos.x}
              y={pos.y + 38}
              textAnchor="middle"
              className="fill-foreground text-xs font-medium"
            >
              {pos.label}
            </text>
          </motion.g>
        ))}
      </svg>
    </div>
  );
}

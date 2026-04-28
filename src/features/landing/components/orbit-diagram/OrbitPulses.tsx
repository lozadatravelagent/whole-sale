import { motion } from 'framer-motion';
import { ORBIT_INNER, ORBIT_OUTER, INNER_RADIUS, OUTER_RADIUS } from '../../data/ecosystemNodes';
import { polar } from './polar';

export function OrbitPulses() {
  return (
    <>
      {ORBIT_INNER.map((node, i) => {
        const target = polar(node.angle, INNER_RADIUS);
        return (
          <motion.circle
            key={`pulse-in-${node.id}`}
            r={0.55}
            fill="hsl(252 65% 68%)"
            initial={{ cx: 50, cy: 50, opacity: 0 }}
            animate={{ cx: [50, target.x], cy: [50, target.y], opacity: [0, 1, 0] }}
            transition={{ duration: 2.6, delay: i * 0.45, repeat: Infinity, repeatDelay: 1.2, ease: 'easeOut' }}
          />
        );
      })}

      {ORBIT_OUTER.map((node, i) => {
        const target = polar(node.angle, OUTER_RADIUS);
        const innerNode = ORBIT_INNER[i % ORBIT_INNER.length];
        const inner = polar(innerNode.angle, INNER_RADIUS);
        return (
          <motion.circle
            key={`pulse-out-${node.id}`}
            r={0.4}
            fill="hsl(220 50% 70%)"
            initial={{ cx: inner.x, cy: inner.y, opacity: 0 }}
            animate={{ cx: [inner.x, target.x], cy: [inner.y, target.y], opacity: [0, 0.9, 0] }}
            transition={{ duration: 3, delay: 0.3 + i * 0.6, repeat: Infinity, repeatDelay: 2, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

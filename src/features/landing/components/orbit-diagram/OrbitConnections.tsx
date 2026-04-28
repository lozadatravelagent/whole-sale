import { motion } from 'framer-motion';
import { ORBIT_INNER, ORBIT_OUTER, INNER_RADIUS, OUTER_RADIUS } from '../../data/ecosystemNodes';
import { polar } from './polar';

interface OrbitConnectionsProps {
  hoverId: string | null;
}

const isInnerId = (id: string) => ORBIT_INNER.some((n) => n.id === id);
const isOuterId = (id: string) => ORBIT_OUTER.some((n) => n.id === id);

/**
 * Returns the inner node that's "linked" to a given outer node — used to
 * highlight the chain when hovering either end.
 */
const linkedInnerForOuterIndex = (outerIndex: number) =>
  ORBIT_INNER[outerIndex % ORBIT_INNER.length];

export function OrbitConnections({ hoverId }: OrbitConnectionsProps) {
  return (
    <>
      {ORBIT_INNER.map((node, i) => {
        const target = polar(node.angle, INNER_RADIUS);
        const active = hoverId === node.id;
        const dim =
          hoverId !== null &&
          hoverId !== node.id &&
          !(isOuterId(hoverId) && linkedInnerForOuterIndex(ORBIT_OUTER.findIndex((o) => o.id === hoverId)).id === node.id);

        return (
          <motion.line
            key={node.id}
            x1={47}
            y1={46}
            x2={target.x}
            y2={target.y}
            stroke={active ? 'url(#orbit-line-active)' : 'url(#orbit-line-inner)'}
            strokeWidth={active ? 0.4 : 0.22}
            strokeDasharray={active ? undefined : '0.6 0.4'}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: dim ? 0.15 : 1 }}
            viewport={{ once: true }}
            animate={{ opacity: dim ? 0.15 : 1 }}
            transition={{ duration: 1.1, delay: 0.3 + i * 0.1, ease: 'easeOut' }}
          />
        );
      })}

      {ORBIT_OUTER.map((node, i) => {
        const outerPoint = polar(node.angle, OUTER_RADIUS);
        const innerNode = linkedInnerForOuterIndex(i);
        const innerPoint = polar(innerNode.angle, INNER_RADIUS);
        const active = hoverId === node.id;
        const dim =
          hoverId !== null &&
          hoverId !== node.id &&
          !(isInnerId(hoverId) && innerNode.id === hoverId);

        return (
          <motion.line
            key={node.id}
            x1={innerPoint.x}
            y1={innerPoint.y}
            x2={outerPoint.x}
            y2={outerPoint.y}
            stroke={active ? 'url(#orbit-line-active)' : 'url(#orbit-line-outer)'}
            strokeWidth={active ? 0.34 : 0.18}
            strokeDasharray={active ? undefined : '0.4 0.5'}
            initial={{ pathLength: 0, opacity: 0 }}
            whileInView={{ pathLength: 1, opacity: dim ? 0.1 : 1 }}
            viewport={{ once: true }}
            animate={{ opacity: dim ? 0.1 : 1 }}
            transition={{ duration: 1, delay: 0.9 + i * 0.08, ease: 'easeOut' }}
          />
        );
      })}
    </>
  );
}

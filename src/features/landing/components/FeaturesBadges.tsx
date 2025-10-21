import { Badge } from '@/components/ui/badge';
import { featureBadges } from '../data/landingData';

export function FeaturesBadges() {
  return (
    <section className="py-12 px-6 overflow-hidden animate-fade-in">
      <div className="text-center mb-8">
        <p className="text-lg font-medium">
          ViBook te devuelve el control del día a día. Menos tiempo buscando información, más tiempo vendiendo.
        </p>
      </div>
      <div className="relative overflow-hidden">
        <div className="flex animate-scroll-infinite gap-6">
          {/* First set of badges */}
          {featureBadges.map((badge, index) => (
            <Badge
              key={`first-${index}`}
              variant="outline"
              className="text-sm px-4 py-2 whitespace-nowrap hover:bg-primary/10 hover:border-primary transition-smooth hover:shadow-primary"
            >
              {badge}
            </Badge>
          ))}
          {/* Duplicate set for infinite loop */}
          {featureBadges.map((badge, index) => (
            <Badge
              key={`second-${index}`}
              variant="outline"
              className="text-sm px-4 py-2 whitespace-nowrap hover:bg-primary/10 hover:border-primary transition-smooth hover:shadow-primary"
            >
              {badge}
            </Badge>
          ))}
        </div>
      </div>
    </section>
  );
}

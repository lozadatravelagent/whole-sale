import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Check } from 'lucide-react';
import type { PricingPlan } from '../types/landing';

interface PricingCardProps extends PricingPlan {
  showAnnual: boolean;
  onCtaClick: () => void;
}

export function PricingCard({
  name,
  description,
  monthlyPrice,
  annualPrice,
  discount,
  popular,
  features,
  cta,
  buttonVariant = 'default',
  showAnnual,
  onCtaClick,
}: PricingCardProps) {
  const displayPrice = showAnnual ? annualPrice : monthlyPrice;
  const billingPeriod = showAnnual ? '/mes (facturado anual)' : '/mes';

  return (
    <Card
      className={`relative transition-all duration-300 hover:scale-105 ${
        popular ? 'border-primary shadow-primary' : ''
      }`}
    >
      {popular && (
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground">
          Más popular
        </Badge>
      )}

      <CardHeader>
        <CardTitle className="text-2xl">{name}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold">${displayPrice}</span>
            <span className="text-muted-foreground ml-2">{billingPeriod}</span>
          </div>
          {showAnnual && discount && (
            <p className="text-sm text-primary font-medium">Ahorrás {discount} pagando anual</p>
          )}
        </div>

        <ul className="space-y-3">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start space-x-3">
              <Check className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>
      </CardContent>

      <CardFooter>
        <Button
          onClick={onCtaClick}
          variant={buttonVariant}
          className={`w-full ${
            buttonVariant === 'default'
              ? 'bg-gradient-hero hover:opacity-90 shadow-primary'
              : 'hover:border-primary hover:text-primary'
          } transition-smooth`}
        >
          {cta}
        </Button>
      </CardFooter>
    </Card>
  );
}

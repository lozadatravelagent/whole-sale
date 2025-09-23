// Shared empty state component
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = ''
}: EmptyStateProps) {
  return (
    <Card className={`border-dashed border-2 ${className}`}>
      <CardContent className="p-12 text-center">
        {icon && (
          <div className="text-6xl mb-4">
            {icon}
          </div>
        )}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-muted-foreground mb-4">
            {description}
          </p>
        )}
        {action && (
          <Button onClick={action.onClick} className="flex items-center gap-2 mx-auto">
            {action.icon}
            {action.label}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
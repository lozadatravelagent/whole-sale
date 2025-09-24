import React from 'react';
import {
    Luggage,
    Briefcase,
    Backpack,
    X,
    HelpCircle,
    MinusCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BaggageType, getBaggageType } from '@/utils/baggageUtils';

interface BaggageIconProps {
    baggage?: string;
    carryOnBagInfo?: {
        quantity?: string;
        weight?: string;
        dimensions?: string;
    } | null;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
}

const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
};

const BaggageIcon: React.FC<BaggageIconProps> = ({
    baggage,
    carryOnBagInfo,
    className,
    size = 'md',
    showTooltip = true
}) => {
    const baggageInfo = getBaggageType(baggage, carryOnBagInfo);

    const renderIcon = () => {
        const iconClassName = cn(iconSizes[size], className);

        // Si se pasa un className personalizado (como text-white), usarlo en lugar de los colores por defecto
        const useCustomColor = className && className.includes('text-');

        const getColorClass = (defaultColor: string) =>
            useCustomColor ? '' : defaultColor;

        switch (baggageInfo.type) {
            case 'checked':
                return (
                    <Luggage
                        className={cn(iconClassName, getColorClass('text-blue-600'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            case 'carryon':
                return (
                    <Briefcase
                        className={cn(iconClassName, getColorClass('text-green-600'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            case 'backpack':
                return (
                    <Backpack
                        className={cn(iconClassName, getColorClass('text-orange-600'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            case 'checked-plus-carryon':
                return (
                    <Luggage
                        className={cn(iconClassName, getColorClass('text-purple-600'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            case 'unspecified-carryon':
                return (
                    <HelpCircle
                        className={cn(iconClassName, getColorClass('text-yellow-600'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            case 'none':
                return (
                    <MinusCircle
                        className={cn(iconClassName, getColorClass('text-gray-400'))}
                        {...({ title: baggageInfo.description } as any)}
                    />
                );
            default:
                return (
                    <HelpCircle
                        className={cn(iconClassName, getColorClass('text-gray-400'))}
                        {...({ title: "Información de equipaje no disponible" } as any)}
                    />
                );
        }
    };

    if (showTooltip && baggageInfo.details) {
        return (
            <div className="group relative">
                {renderIcon()}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                    {baggageInfo.description}
                    {baggageInfo.details && (
                        <div className="text-gray-300">
                            {baggageInfo.details}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return renderIcon();
};

export default BaggageIcon;

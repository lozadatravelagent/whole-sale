// Currency formatting utilities for CRM
export const formatCurrency = (amount?: number, currency: string = 'USD'): string => {
  if (!amount) return '$0';

  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const parseCurrency = (currencyString: string): number => {
  const cleaned = currencyString.replace(/[^\d.-]/g, '');
  return parseFloat(cleaned) || 0;
};

export const formatBudgetRange = (min?: number, max?: number, currency: string = 'USD'): string => {
  if (!min && !max) return 'Sin rango';
  if (min && !max) return `Desde ${formatCurrency(min, currency)}`;
  if (!min && max) return `Hasta ${formatCurrency(max, currency)}`;
  return `${formatCurrency(min, currency)} - ${formatCurrency(max, currency)}`;
};
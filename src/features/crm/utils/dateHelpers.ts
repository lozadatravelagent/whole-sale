// Date and time utilities for CRM travel features
export const formatDate = (dateString: string, format: 'short' | 'long' | 'medium' = 'medium'): string => {
  if (!dateString) return '';

  const date = new Date(dateString);

  const options: Intl.DateTimeFormatOptions = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }
  }[format];

  return date.toLocaleDateString('es-ES', options);
};

export const calculateConnectionTime = (segment1: any, segment2: any): string => {
  if (!segment1?.arrival?.time || !segment2?.departure?.time) {
    return 'N/A';
  }

  try {
    const [arr1Hours, arr1Minutes] = segment1.arrival.time.split(':').map(Number);
    const [dep2Hours, dep2Minutes] = segment2.departure.time.split(':').map(Number);

    const arrivalMinutes = arr1Hours * 60 + arr1Minutes;
    const departureMinutes = dep2Hours * 60 + dep2Minutes;

    let connectionMinutes = departureMinutes - arrivalMinutes;

    if (connectionMinutes < 0) {
      connectionMinutes += 24 * 60;
    }

    const hours = Math.floor(connectionMinutes / 60);
    const minutes = connectionMinutes % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  } catch (error) {
    console.error('Error calculating connection time:', error);
    return 'N/A';
  }
};

export const calculateTripDuration = (checkin: string, checkout: string): number => {
  if (!checkin || !checkout) return 0;

  const start = new Date(checkin);
  const end = new Date(checkout);
  const diffTime = Math.abs(end.getTime() - start.getTime());

  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isDateInRange = (date: string, startDate?: string, endDate?: string): boolean => {
  if (!date) return false;

  const checkDate = new Date(date);

  if (startDate && checkDate < new Date(startDate)) return false;
  if (endDate && checkDate > new Date(endDate)) return false;

  return true;
};
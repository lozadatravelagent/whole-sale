// Lead data formatting utilities
import type { Lead, LeadStatus, ChecklistItem } from '@/types';
import type { LeadContact, TripDetails } from '../types/lead';

export const formatLeadTitle = (lead: Lead): string => {
  return lead.contact.name || 'Sin nombre';
};

export const formatLeadSubtitle = (lead: Lead): string => {
  const { trip } = lead;
  const duration = trip.dates.checkin && trip.dates.checkout
    ? Math.ceil((new Date(trip.dates.checkout).getTime() - new Date(trip.dates.checkin).getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  return `${trip.city} • ${duration} días • ${trip.adults + trip.children} personas`;
};

export const formatTripType = (type: 'hotel' | 'flight' | 'package'): string => {
  const typeMap = {
    hotel: 'Hotel',
    flight: 'Vuelo',
    package: 'Paquete'
  };
  return typeMap[type] || type;
};

export const formatLeadStatusColor = (status: LeadStatus): string => {
  const colorMap = {
    new: 'bg-blue-500',
    quoted: 'bg-yellow-500',
    negotiating: 'bg-orange-500',
    won: 'bg-green-500',
    lost: 'bg-red-500'
  };
  return colorMap[status] || 'bg-gray-500';
};

export const getLeadPriorityScore = (lead: Lead): number => {
  let score = 0;

  // Budget weight
  if (lead.budget) {
    if (lead.budget >= 10000) score += 5;
    else if (lead.budget >= 5000) score += 3;
    else if (lead.budget >= 1000) score += 1;
  }

  // Due date urgency
  if (lead.due_date) {
    const daysUntilDue = Math.ceil((new Date(lead.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (daysUntilDue <= 3) score += 5;
    else if (daysUntilDue <= 7) score += 3;
    else if (daysUntilDue <= 14) score += 1;
  }

  // Status weight
  const statusWeights = { new: 1, quoted: 3, negotiating: 5, won: 0, lost: 0 };
  score += statusWeights[lead.status] || 0;

  return score;
};

export const calculateChecklistProgress = (checklist?: ChecklistItem[]): number => {
  if (!checklist || checklist.length === 0) return 0;

  const completed = checklist.filter(item => item.completed).length;
  return Math.round((completed / checklist.length) * 100);
};

export const getDefaultChecklist = (): ChecklistItem[] => [
  { id: '1', text: 'Usuario Contactado', completed: false },
  { id: '2', text: 'Presupuesto Enviado', completed: false },
  { id: '3', text: 'Presupuesto Pagado', completed: false },
  { id: '4', text: 'Pasaporte Subido', completed: false }
];

export const validateLeadContact = (contact: LeadContact): string[] => {
  const errors: string[] = [];

  if (!contact.name?.trim()) {
    errors.push('El nombre es requerido');
  }

  if (!contact.phone?.trim()) {
    errors.push('El teléfono es requerido');
  }

  if (contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email)) {
    errors.push('El email no es válido');
  }

  return errors;
};

export const validateTripDetails = (trip: TripDetails): string[] => {
  const errors: string[] = [];

  if (!trip.city?.trim()) {
    errors.push('La ciudad es requerida');
  }

  if (!trip.dates.checkin) {
    errors.push('La fecha de entrada es requerida');
  }

  if (!trip.dates.checkout) {
    errors.push('La fecha de salida es requerida');
  }

  if (trip.dates.checkin && trip.dates.checkout) {
    const checkin = new Date(trip.dates.checkin);
    const checkout = new Date(trip.dates.checkout);

    if (checkout <= checkin) {
      errors.push('La fecha de salida debe ser posterior a la fecha de entrada');
    }
  }

  if (trip.adults < 1) {
    errors.push('Debe haber al menos 1 adulto');
  }

  if (trip.children < 0) {
    errors.push('El número de niños no puede ser negativo');
  }

  return errors;
};
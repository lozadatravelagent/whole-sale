// Barrel export for all CRM types
export * from './lead';
export * from './kanban';
export * from './travel';

// Re-export commonly used types from main types
export type {
  Section,
  Seller,
  User
} from '@/types';
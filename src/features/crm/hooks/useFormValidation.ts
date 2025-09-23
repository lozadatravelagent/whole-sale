// Hook for form validation with CRM-specific rules
import { useState, useCallback, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ChecklistItem } from '@/types';
import type { LeadFormData } from '../types/lead';
import { ValidationService, leadSchema, type LeadFormValidationData } from '../services/validationService';
import { getDefaultChecklist } from '../utils/leadFormatters';

export function useFormValidation(initialData?: Partial<LeadFormData>) {
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [customValidationErrors, setCustomValidationErrors] = useState<string[]>([]);
  const [customValidationWarnings, setCustomValidationWarnings] = useState<string[]>([]);

  // Form setup with React Hook Form
  const form = useForm<LeadFormValidationData>({
    resolver: zodResolver(leadSchema),
    defaultValues: initialData || {
      contact: { name: '', phone: '', email: '' },
      trip: {
        type: 'hotel',
        city: '',
        dates: { checkin: '', checkout: '' },
        adults: 1,
        children: 0
      },
      status: 'new',
      budget: 0,
      description: '',
      due_date: ''
    }
  });

  // Initialize checklist
  useEffect(() => {
    if (initialData?.checklist) {
      setChecklist(Array.isArray(initialData.checklist) ? initialData.checklist : []);
    } else {
      setChecklist(getDefaultChecklist());
    }
  }, [initialData]);

  // Add checklist item
  const addChecklistItem = useCallback(() => {
    if (newChecklistItem.trim()) {
      const newItem: ChecklistItem = {
        id: Date.now().toString(),
        text: newChecklistItem.trim(),
        completed: false
      };
      setChecklist(prev => [...prev, newItem]);
      setNewChecklistItem('');
    }
  }, [newChecklistItem]);

  // Toggle checklist item
  const toggleChecklistItem = useCallback((id: string) => {
    setChecklist(prev =>
      prev.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  }, []);

  // Remove checklist item
  const removeChecklistItem = useCallback((id: string) => {
    setChecklist(prev => prev.filter(item => item.id !== id));
  }, []);

  // Calculate checklist progress
  const getChecklistProgress = useCallback(() => {
    if (checklist.length === 0) return 0;
    const completed = checklist.filter(item => item.completed).length;
    return Math.round((completed / checklist.length) * 100);
  }, [checklist]);

  // Perform custom validation
  const performCustomValidation = useCallback((data: LeadFormValidationData) => {
    const result = ValidationService.validateLeadComplete(data);
    setCustomValidationErrors(result.errors);
    setCustomValidationWarnings(result.warnings);
    return result;
  }, []);

  // Enhanced submit handler with custom validation
  const handleSubmitWithValidation = useCallback((
    onSubmit: (data: LeadFormValidationData & { checklist: ChecklistItem[] }) => void
  ) => {
    return form.handleSubmit(async (data) => {
      // Perform custom validation
      const validationResult = performCustomValidation(data);

      if (!validationResult.isValid) {
        // Don't submit if there are validation errors
        return;
      }

      // Submit with checklist
      onSubmit({ ...data, checklist });
    });
  }, [form, checklist, performCustomValidation]);

  // Real-time validation on field changes
  const validateField = useCallback((fieldName: keyof LeadFormValidationData, value: any) => {
    try {
      const currentValues = form.getValues();
      const updatedValues = { ...currentValues, [fieldName]: value };

      // Validate specific field combinations
      if (fieldName === 'trip.dates.checkin' || fieldName === 'trip.dates.checkout') {
        const checkin = fieldName === 'trip.dates.checkin' ? value : currentValues.trip?.dates?.checkin;
        const checkout = fieldName === 'trip.dates.checkout' ? value : currentValues.trip?.dates?.checkout;

        if (checkin && checkout) {
          const errors = ValidationService.validateDateRange(checkin, checkout);
          if (errors.length > 0) {
            form.setError(fieldName as any, { message: errors[0] });
          } else {
            form.clearErrors(fieldName as any);
          }
        }
      }

      if (fieldName === 'budget' && value > 0) {
        const tripType = currentValues.trip?.type || 'hotel';
        const errors = ValidationService.validateBudget(value, tripType);
        if (errors.length > 0) {
          form.setError('budget', { message: errors[0] });
        } else {
          form.clearErrors('budget');
        }
      }

      if (fieldName === 'contact.phone') {
        if (!ValidationService.validatePhone(value)) {
          form.setError('contact.phone', { message: 'Formato de teléfono inválido' });
        } else {
          form.clearErrors('contact.phone');
        }
      }
    } catch (error) {
      console.error('Error validating field:', error);
    }
  }, [form]);

  // Watch for form changes and validate
  const watchedValues = form.watch();
  useEffect(() => {
    if (watchedValues.trip?.dates?.checkin && watchedValues.trip?.dates?.checkout) {
      validateField('trip.dates.checkin', watchedValues.trip.dates.checkin);
    }
    if (watchedValues.budget) {
      validateField('budget', watchedValues.budget);
    }
    if (watchedValues.contact?.phone) {
      validateField('contact.phone', watchedValues.contact.phone);
    }
  }, [watchedValues, validateField]);

  // Reset form with new data
  const resetForm = useCallback((newData?: Partial<LeadFormData>) => {
    if (newData) {
      form.reset(newData);
      if (newData.checklist) {
        setChecklist(Array.isArray(newData.checklist) ? newData.checklist : []);
      } else {
        setChecklist(getDefaultChecklist());
      }
    } else {
      form.reset();
      setChecklist(getDefaultChecklist());
    }
    setCustomValidationErrors([]);
    setCustomValidationWarnings([]);
    setNewChecklistItem('');
  }, [form]);

  // Check if form has changes
  const hasChanges = useCallback(() => {
    const currentValues = form.getValues();
    const defaultValues = form.formState.defaultValues;

    // Simple comparison - could be enhanced for deep comparison
    return JSON.stringify(currentValues) !== JSON.stringify(defaultValues) ||
           checklist.length > 0;
  }, [form, checklist]);

  // Get all validation errors (form + custom)
  const getAllErrors = useCallback(() => {
    const formErrors = Object.values(form.formState.errors)
      .map(error => error?.message)
      .filter(Boolean) as string[];

    return [...formErrors, ...customValidationErrors];
  }, [form.formState.errors, customValidationErrors]);

  return {
    // Form control
    form,
    handleSubmitWithValidation,
    resetForm,
    validateField,

    // Checklist management
    checklist,
    newChecklistItem,
    setNewChecklistItem,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    getChecklistProgress,

    // Validation state
    customValidationErrors,
    customValidationWarnings,
    getAllErrors,
    hasChanges,

    // Form state
    isValid: form.formState.isValid && customValidationErrors.length === 0,
    isSubmitting: form.formState.isSubmitting,
    isDirty: form.formState.isDirty || hasChanges()
  };
}
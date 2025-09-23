// Hook for managing travel selection (flights and hotels)
import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { FlightData, HotelData } from '@/types';
import type { TravelSelectionState } from '../types/travel';
import { PdfService } from '../services/pdfService';

export function useTravelSelection() {
  const [selectionState, setSelectionState] = useState<TravelSelectionState>({
    selectedFlights: [],
    selectedHotels: [],
    isGeneratingPdf: false,
    activeTab: 'flights'
  });

  const { toast } = useToast();

  // Select/deselect flights
  const toggleFlightSelection = useCallback((flight: FlightData) => {
    setSelectionState(prev => {
      const isSelected = prev.selectedFlights.some(f => f.id === flight.id);

      let newSelectedFlights: FlightData[];
      if (isSelected) {
        newSelectedFlights = prev.selectedFlights.filter(f => f.id !== flight.id);
      } else {
        newSelectedFlights = [...prev.selectedFlights, flight];
      }

      return {
        ...prev,
        selectedFlights: newSelectedFlights
      };
    });
  }, []);

  // Select/deselect hotels
  const toggleHotelSelection = useCallback((hotel: HotelData) => {
    setSelectionState(prev => {
      const isSelected = prev.selectedHotels.some(h => h.id === hotel.id);

      let newSelectedHotels: HotelData[];
      if (isSelected) {
        newSelectedHotels = prev.selectedHotels.filter(h => h.id !== hotel.id);
      } else {
        newSelectedHotels = [...prev.selectedHotels, hotel];
      }

      return {
        ...prev,
        selectedHotels: newSelectedHotels
      };
    });
  }, []);

  // Set multiple flights at once
  const setSelectedFlights = useCallback((flights: FlightData[]) => {
    setSelectionState(prev => ({
      ...prev,
      selectedFlights: flights
    }));
  }, []);

  // Set multiple hotels at once
  const setSelectedHotels = useCallback((hotels: HotelData[]) => {
    setSelectionState(prev => ({
      ...prev,
      selectedHotels: hotels
    }));
  }, []);

  // Clear all selections
  const clearSelections = useCallback(() => {
    setSelectionState(prev => ({
      ...prev,
      selectedFlights: [],
      selectedHotels: []
    }));
  }, []);

  // Clear flight selections only
  const clearFlightSelections = useCallback(() => {
    setSelectionState(prev => ({
      ...prev,
      selectedFlights: []
    }));
  }, []);

  // Clear hotel selections only
  const clearHotelSelections = useCallback(() => {
    setSelectionState(prev => ({
      ...prev,
      selectedHotels: []
    }));
  }, []);

  // Change active tab
  const setActiveTab = useCallback((tab: 'flights' | 'hotels' | 'combined') => {
    setSelectionState(prev => ({
      ...prev,
      activeTab: tab
    }));
  }, []);

  // Check if flight is selected
  const isFlightSelected = useCallback((flightId: string): boolean => {
    return selectionState.selectedFlights.some(f => f.id === flightId);
  }, [selectionState.selectedFlights]);

  // Check if hotel is selected
  const isHotelSelected = useCallback((hotelId: string): boolean => {
    return selectionState.selectedHotels.some(h => h.id === hotelId);
  }, [selectionState.selectedHotels]);

  // Generate PDF for selected items
  const generatePdf = useCallback(async (
    customerInfo?: {
      name: string;
      email?: string;
      phone: string;
    }
  ): Promise<string | null> => {
    if (selectionState.selectedFlights.length === 0 && selectionState.selectedHotels.length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Seleccione al menos un vuelo o hotel para generar el PDF."
      });
      return null;
    }

    setSelectionState(prev => ({ ...prev, isGeneratingPdf: true }));

    try {
      let pdfUrl: string | null = null;

      if (selectionState.selectedFlights.length > 0 && selectionState.selectedHotels.length > 0) {
        // Generate combined PDF
        pdfUrl = await PdfService.generateCombinedQuote(
          selectionState.selectedFlights,
          selectionState.selectedHotels,
          customerInfo
        );
      } else if (selectionState.selectedFlights.length > 0) {
        // Generate flight-only PDF
        pdfUrl = await PdfService.generateFlightQuote(
          selectionState.selectedFlights,
          customerInfo
        );
      } else if (selectionState.selectedHotels.length > 0) {
        // Generate hotel-only PDF
        pdfUrl = await PdfService.generateHotelQuote(
          selectionState.selectedHotels,
          customerInfo
        );
      }

      if (pdfUrl) {
        toast({
          title: "Éxito",
          description: "PDF generado correctamente."
        });
        return pdfUrl;
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "No se pudo generar el PDF."
        });
        return null;
      }
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error al generar el PDF."
      });
      return null;
    } finally {
      setSelectionState(prev => ({ ...prev, isGeneratingPdf: false }));
    }
  }, [selectionState.selectedFlights, selectionState.selectedHotels, toast]);

  // Get selection summary
  const getSelectionSummary = useCallback(() => {
    const totals = PdfService.calculateQuoteTotal(
      selectionState.selectedFlights,
      selectionState.selectedHotels
    );

    return {
      flightCount: selectionState.selectedFlights.length,
      hotelCount: selectionState.selectedHotels.length,
      totalItems: selectionState.selectedFlights.length + selectionState.selectedHotels.length,
      ...totals
    };
  }, [selectionState.selectedFlights, selectionState.selectedHotels]);

  // Get formatted quote summary
  const getFormattedQuoteSummary = useCallback(() => {
    return PdfService.formatQuoteSummary(
      selectionState.selectedFlights,
      selectionState.selectedHotels
    );
  }, [selectionState.selectedFlights, selectionState.selectedHotels]);

  // Validate selection for PDF generation
  const canGeneratePdf = useCallback((): boolean => {
    return selectionState.selectedFlights.length > 0 || selectionState.selectedHotels.length > 0;
  }, [selectionState.selectedFlights.length, selectionState.selectedHotels.length]);

  // Get selection state for external components
  const getSelectionState = useCallback((): TravelSelectionState => {
    return { ...selectionState };
  }, [selectionState]);

  return {
    // State
    selectedFlights: selectionState.selectedFlights,
    selectedHotels: selectionState.selectedHotels,
    activeTab: selectionState.activeTab,
    isGeneratingPdf: selectionState.isGeneratingPdf,

    // Actions
    toggleFlightSelection,
    toggleHotelSelection,
    setSelectedFlights,
    setSelectedHotels,
    clearSelections,
    clearFlightSelections,
    clearHotelSelections,
    setActiveTab,

    // Utilities
    isFlightSelected,
    isHotelSelected,
    generatePdf,
    getSelectionSummary,
    getFormattedQuoteSummary,
    canGeneratePdf,
    getSelectionState
  };
}
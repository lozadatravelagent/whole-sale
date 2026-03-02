import { useState, useCallback } from 'react';
import {
  searchAvailability,
  checkRate,
  createBooking,
  cancelBooking,
  type HotelbedsSearchParams,
  type HotelbedsHotel,
  type HotelbedsRate,
  type HotelbedsCheckRateResult,
  type HotelbedsBookingResult,
  type HotelbedsCancelResult,
  type HotelbedsBookingParams,
} from '../services/hotelbedsService';

export type WorkflowState =
  | 'IDLE'
  | 'SEARCHING'
  | 'RESULTS'
  | 'CHECK_RATE'
  | 'RATE_CONFIRMED'
  | 'BOOKING'
  | 'BOOKED'
  | 'VOUCHER'
  | 'CANCELLING'
  | 'CANCELLED'
  | 'ERROR';

interface HotelbedsSearchState {
  workflow: WorkflowState;
  hotels: HotelbedsHotel[];
  totalHotels: number;
  checkIn: string;
  checkOut: string;
  selectedRate: HotelbedsRate | null;
  selectedHotel: HotelbedsHotel | null;
  checkRateResult: HotelbedsCheckRateResult | null;
  bookingResult: HotelbedsBookingResult | null;
  cancelResult: HotelbedsCancelResult | null;
  error: string | null;
  // Pagination
  currentPage: number;
  pageSize: number;
  // Filters
  filters: {
    minPrice?: number;
    maxPrice?: number;
    minStars?: number;
    maxStars?: number;
    boardCode?: string;
  };
}

const initialState: HotelbedsSearchState = {
  workflow: 'IDLE',
  hotels: [],
  totalHotels: 0,
  checkIn: '',
  checkOut: '',
  selectedRate: null,
  selectedHotel: null,
  checkRateResult: null,
  bookingResult: null,
  cancelResult: null,
  error: null,
  currentPage: 1,
  pageSize: 10,
  filters: {},
};

export function useHotelbedsSearch() {
  const [state, setState] = useState<HotelbedsSearchState>(initialState);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const setFilters = useCallback((filters: HotelbedsSearchState['filters']) => {
    setState(prev => ({ ...prev, filters, currentPage: 1 }));
  }, []);

  const setPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  }, []);

  // Step 1: Search Availability
  const search = useCallback(async (params: HotelbedsSearchParams) => {
    setState(prev => ({ ...prev, workflow: 'SEARCHING', error: null, hotels: [], selectedRate: null, selectedHotel: null, checkRateResult: null, bookingResult: null, cancelResult: null }));

    try {
      const result = await searchAvailability(params);
      setState(prev => ({
        ...prev,
        workflow: 'RESULTS',
        hotels: result.hotels || [],
        totalHotels: result.total || 0,
        checkIn: result.checkIn || params.checkIn,
        checkOut: result.checkOut || params.checkOut,
        currentPage: 1,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        workflow: 'ERROR',
        error: err instanceof Error ? err.message : 'Search failed',
      }));
    }
  }, []);

  // Step 2: Check Rate (only if rateType === 'RECHECK')
  const doCheckRate = useCallback(async (hotel: HotelbedsHotel, rate: HotelbedsRate) => {
    setState(prev => ({ ...prev, workflow: 'CHECK_RATE', selectedHotel: hotel, selectedRate: rate, error: null }));

    try {
      if (rate.rateType === 'BOOKABLE') {
        // Already bookable, skip checkRate
        setState(prev => ({
          ...prev,
          workflow: 'RATE_CONFIRMED',
          checkRateResult: null,
        }));
        return;
      }

      const result = await checkRate(rate.rateKey);

      // Validate that the rate is now BOOKABLE
      const updatedRate = result.hotel?.rooms?.[0]?.rates?.[0];
      if (updatedRate && updatedRate.rateType === 'BOOKABLE') {
        setState(prev => ({
          ...prev,
          workflow: 'RATE_CONFIRMED',
          checkRateResult: result,
          selectedRate: updatedRate,
        }));
      } else {
        setState(prev => ({
          ...prev,
          workflow: 'ERROR',
          error: 'Rate is not bookable after CheckRate. Please select another rate.',
        }));
      }
    } catch (err) {
      setState(prev => ({
        ...prev,
        workflow: 'ERROR',
        error: err instanceof Error ? err.message : 'CheckRate failed',
      }));
    }
  }, []);

  // Step 3: Create Booking (only if rateType === 'BOOKABLE')
  const doBooking = useCallback(async (params: Omit<HotelbedsBookingParams, 'rateKey'>) => {
    if (!state.selectedRate) {
      setState(prev => ({ ...prev, workflow: 'ERROR', error: 'No rate selected' }));
      return;
    }

    setState(prev => ({ ...prev, workflow: 'BOOKING', error: null }));

    try {
      const result = await createBooking({
        ...params,
        rateKey: state.selectedRate.rateKey,
      });

      console.log('[HOTELBEDS] Booking result:', JSON.stringify(result, null, 2));

      setState(prev => ({
        ...prev,
        workflow: 'BOOKED',
        bookingResult: result,
      }));
    } catch (err) {
      // 500 errors: restart entire booking flow
      const message = err instanceof Error ? err.message : 'Booking failed';
      if (message.includes('restart booking flow') || message.includes('500')) {
        setState(prev => ({
          ...prev,
          workflow: 'ERROR',
          error: 'Server error during booking. Please restart the entire flow from availability search.',
        }));
      } else {
        setState(prev => ({
          ...prev,
          workflow: 'ERROR',
          error: message,
        }));
      }
    }
  }, [state.selectedRate]);

  // Show Voucher
  const showVoucher = useCallback(() => {
    setState(prev => ({ ...prev, workflow: 'VOUCHER' }));
  }, []);

  // Cancel Booking
  const doCancel = useCallback(async (reference: string) => {
    setState(prev => ({ ...prev, workflow: 'CANCELLING', error: null }));

    try {
      const result = await cancelBooking(reference);
      setState(prev => ({
        ...prev,
        workflow: 'CANCELLED',
        cancelResult: result,
      }));
    } catch (err) {
      setState(prev => ({
        ...prev,
        workflow: 'ERROR',
        error: err instanceof Error ? err.message : 'Cancellation failed',
      }));
    }
  }, []);

  // Get filtered and paginated hotels
  const getFilteredHotels = useCallback(() => {
    let filtered = [...state.hotels];

    if (state.filters.minPrice !== undefined) {
      filtered = filtered.filter(h => parseFloat(h.minRate) >= state.filters.minPrice!);
    }
    if (state.filters.maxPrice !== undefined) {
      filtered = filtered.filter(h => parseFloat(h.minRate) <= state.filters.maxPrice!);
    }
    if (state.filters.minStars !== undefined) {
      filtered = filtered.filter(h => {
        const stars = parseInt(h.categoryCode?.match(/^(\d)/)?.[1] || '0');
        return stars >= state.filters.minStars!;
      });
    }
    if (state.filters.maxStars !== undefined) {
      filtered = filtered.filter(h => {
        const stars = parseInt(h.categoryCode?.match(/^(\d)/)?.[1] || '0');
        return stars <= state.filters.maxStars!;
      });
    }
    if (state.filters.boardCode) {
      filtered = filtered.filter(h =>
        h.rooms.some(r => r.rates.some(rate => rate.boardCode === state.filters.boardCode))
      );
    }

    return filtered;
  }, [state.hotels, state.filters]);

  const getPaginatedHotels = useCallback(() => {
    const filtered = getFilteredHotels();
    const start = (state.currentPage - 1) * state.pageSize;
    const end = start + state.pageSize;
    return {
      hotels: filtered.slice(start, end),
      totalPages: Math.ceil(filtered.length / state.pageSize),
      totalFiltered: filtered.length,
    };
  }, [getFilteredHotels, state.currentPage, state.pageSize]);

  return {
    ...state,
    search,
    doCheckRate,
    doBooking,
    showVoucher,
    doCancel,
    reset,
    setFilters,
    setPage,
    getFilteredHotels,
    getPaginatedHotels,
  };
}

import type { FlightData } from '@/types';

export interface PdfAnalysisResult {
    success: boolean;
    content?: {
        flights?: Array<{
            airline: string;
            route: string;
            price: number;
            dates: string;
        }>;
        hotels?: Array<{
            name: string;
            location: string;
            price: number;
            nights: number;
            category?: string;
            packagePrice?: number;
            roomDescription?: string;
            roomType?: string;
            mealPlan?: string;
            optionNumber?: number;
        }>;
        totalPrice?: number;
        currency?: string;
        passengers?: number;
        adults?: number;
        childrens?: number;
        infants?: number;
        originalTemplate?: string;
        needsComplexTemplate?: boolean;
        extractedFromPdfMonkey?: boolean;
        extractedFromAI?: boolean;
        destination?: string;
        hasTransfers?: boolean;
        hasTravelAssistance?: boolean;
    };
    suggestions?: string[];
    error?: string;
}

export interface PdfUploadResult {
    success: boolean;
    url?: string;
    error?: string;
}

export interface CheaperFlightSearchResult {
    success: boolean;
    originalFlights?: Array<{
        airline: string;
        route: string;
        price: number;
        dates: string;
    }>;
    alternativeFlights?: FlightData[];
    savings?: number;
    message?: string;
    error?: string;
}

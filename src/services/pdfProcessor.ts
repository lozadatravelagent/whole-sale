/**
 * PDF Processor Service - Slim Facade
 * Re-exports from focused modules in ./pdf/
 */

export type { PdfAnalysisResult, PdfUploadResult, CheaperFlightSearchResult } from './pdf/pdfTypes';
export { uploadPdfFile, analyzePdfContent, generatePriceChangeSuggestions, processPriceChangeRequest, searchCheaperFlights } from './pdf/pdfAnalysis';
export { generateModifiedPdf, generateModifiedPdfWithIndividualPrices, generateModifiedPdfWithHotelPrice } from './pdf/pdfGeneration';

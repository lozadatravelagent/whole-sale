/// <reference types="node" />
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import pdf from "npm:pdf-parse@1.1.1";
import { Buffer } from "node:buffer";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
    'Access-Control-Max-Age': '86400'
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
        return new Response(null, {
            status: 200,
            headers: corsHeaders
        });
    }

    try {
        console.log('📄 PDF extraction request received:', req.method, req.url);

        const { pdfData, fileName } = await req.json();

        if (!pdfData || !Array.isArray(pdfData)) {
            console.error('❌ Invalid PDF data format');
            throw new Error('PDF data is required and must be an array');
        }

        console.log('📄 Processing PDF:', fileName, 'Data length:', pdfData.length);

        // Convert array back to Buffer (pdf-parse expects Buffer)
        const buffer = Buffer.from(pdfData);

        console.log('📄 Starting PDF parsing with pdf-parse...');

        try {
            // Parse PDF with pdf-parse library
            const pdfData = await pdf(buffer, {
                // Options for better text extraction
                normalizeWhitespace: true,
                disableCombineTextItems: false,
                // Try to preserve text structure
                max: 0 // No page limit
            });

            console.log('📄 PDF parsed successfully');
            console.log('📄 Extracted text length:', pdfData.text.length);
            console.log('📄 Number of pages:', pdfData.numpages);
            console.log('📄 First 1000 chars of extracted text:');
            console.log(pdfData.text.substring(0, 1000));

            // Clean up the text
            const cleanedText = pdfData.text
                .replace(/\s+/g, ' ') // Normalize whitespace
                .trim();

            if (cleanedText.length < 10) {
                console.log('⚠️ Extracted text is too short, trying alternative extraction...');

                // Try with different options
                const alternativeData = await pdf(buffer, {
                    normalizeWhitespace: false,
                    disableCombineTextItems: true,
                    max: 0
                });

                const alternativeText = alternativeData.text
                    .replace(/\s+/g, ' ')
                    .trim();

                if (alternativeText.length > cleanedText.length) {
                    console.log('📄 Alternative extraction yielded better results');
                    return new Response(JSON.stringify({
                        success: true,
                        text: alternativeText,
                        pages: alternativeData.numpages,
                        info: {
                            title: fileName,
                            numPages: alternativeData.numpages,
                            extractedLength: alternativeText.length,
                            method: 'pdf-parse-alternative'
                        },
                        timestamp: new Date().toISOString(),
                        parser: 'pdf-parse-alternative'
                    }), {
                        headers: {
                            ...corsHeaders,
                            'Content-Type': 'application/json'
                        }
                    });
                }
            }

            return new Response(JSON.stringify({
                success: true,
                text: cleanedText,
                pages: pdfData.numpages,
                info: {
                    title: fileName,
                    numPages: pdfData.numpages,
                    extractedLength: cleanedText.length,
                    method: 'pdf-parse'
                },
                timestamp: new Date().toISOString(),
                parser: 'pdf-parse'
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } catch (parseError) {
            console.error('❌ pdf-parse error:', parseError);

            // Fallback to simple text extraction
            console.log('📄 Falling back to simple text extraction...');

            try {
                const uint8Array = new Uint8Array(pdfData);
                const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
                const rawText = textDecoder.decode(uint8Array);

                // Extract readable text by filtering out binary data
                let readableText = rawText
                    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, ' ') // Remove control characters
                    .replace(/\s+/g, ' ') // Normalize whitespace
                    .trim();

                // Try to extract text from PDF structure
                const pdfTextMatches = rawText.match(/\((.*?)\)/g);
                if (pdfTextMatches) {
                    const extractedPdfText = pdfTextMatches
                        .map(match => match.replace(/[()]/g, ''))
                        .filter(text => text.length > 2 && /[A-Za-z]/.test(text))
                        .join(' ');

                    if (extractedPdfText.length > readableText.length) {
                        readableText = extractedPdfText;
                    }
                }

                // Also try to extract from PDF streams
                const streamMatches = rawText.match(/stream\s+(.*?)\s+endstream/g);
                if (streamMatches) {
                    for (const stream of streamMatches) {
                        const streamText = stream
                            .replace(/stream\s+/, '')
                            .replace(/\s+endstream/, '')
                            .replace(/[^\x20-\x7E]/g, ' ')
                            .trim();

                        if (streamText.length > 10) {
                            readableText += ' ' + streamText;
                        }
                    }
                }

                if (readableText.length < 10) {
                    throw new Error('PDF text extraction resulted in insufficient content. The PDF may be image-based or corrupted.');
                }

                return new Response(JSON.stringify({
                    success: true,
                    text: readableText,
                    pages: 1,
                    info: {
                        title: fileName,
                        numPages: 1,
                        extractedLength: readableText.length,
                        method: 'fallback-extraction'
                    },
                    timestamp: new Date().toISOString(),
                    parser: 'fallback-simple'
                }), {
                    headers: {
                        ...corsHeaders,
                        'Content-Type': 'application/json'
                    }
                });

            } catch (fallbackError) {
                console.error('❌ Fallback extraction error:', fallbackError);
                throw new Error(`PDF text extraction failed with both pdf-parse and fallback methods: ${parseError.message}`);
            }
        }

    } catch (error) {
        console.error('❌ PDF extraction error:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
            timestamp: new Date().toISOString()
        }), {
            status: 500,
            headers: {
                ...corsHeaders,
                'Content-Type': 'application/json'
            }
        });
    }
});
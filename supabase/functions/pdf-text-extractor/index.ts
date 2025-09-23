import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    try {
        const { pdfData, fileName } = await req.json();

        if (!pdfData || !Array.isArray(pdfData)) {
            throw new Error('PDF data is required and must be an array');
        }

        console.log('📄 Processing PDF:', fileName);

        // Convert array back to Uint8Array
        const uint8Array = new Uint8Array(pdfData);

        // Use pdf-parse library to extract text
        // For now, we'll use a simplified approach with dynamic import
        try {
            // Import pdf-parse library
            const pdfParse = await import('https://esm.sh/pdf-parse@1.1.1');

            // Extract text from PDF
            const pdfBuffer = uint8Array.buffer;
            const data = await pdfParse.default(pdfBuffer);

            const extractedText = data.text;
            console.log('✅ PDF text extracted, length:', extractedText.length);

            return new Response(JSON.stringify({
                success: true,
                text: extractedText,
                pages: data.numpages,
                info: data.info,
                timestamp: new Date().toISOString()
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });

        } catch (parseError) {
            console.error('❌ PDF parsing error:', parseError);

            // Fallback: try to extract text using a simpler method
            const textDecoder = new TextDecoder('utf-8', { ignoreBOM: true, fatal: false });
            let fallbackText = '';

            try {
                // Try to decode as UTF-8 (this will work for some PDFs)
                fallbackText = textDecoder.decode(uint8Array);
                // Clean up the text by removing non-printable characters
                fallbackText = fallbackText.replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
            } catch {
                fallbackText = 'Could not extract text from PDF';
            }

            if (fallbackText.length < 10) {
                throw new Error('PDF appears to be image-based or encrypted. Text extraction failed.');
            }

            return new Response(JSON.stringify({
                success: true,
                text: fallbackText,
                pages: 1,
                info: { title: fileName },
                timestamp: new Date().toISOString(),
                fallback: true
            }), {
                headers: {
                    ...corsHeaders,
                    'Content-Type': 'application/json'
                }
            });
        }

    } catch (error) {
        console.error('❌ PDF extraction error:', error);

        return new Response(JSON.stringify({
            success: false,
            error: error.message,
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
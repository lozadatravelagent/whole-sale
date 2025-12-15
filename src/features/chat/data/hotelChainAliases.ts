/**
 * Hotel Chain Aliases - Centralized detection system for hotel chains
 * 
 * Similar to airlineAliases.ts but for hotel chains.
 * Handles variations, typos, and common aliases for hotel chain names.
 */

export interface HotelChainInfo {
    name: string;           // Canonical name
    aliases: string[];      // All known aliases/variations
}

/**
 * Comprehensive list of hotel chains with their aliases
 * Aliases should be lowercase for comparison
 */
export const HOTEL_CHAINS: Record<string, HotelChainInfo> = {
    // Major international chains
    riu: {
        name: 'RIU',
        aliases: ['riu', 'riu hotels', 'hoteles riu', 'riu resorts', 'riu palace', 'riu playacar']
    },
    iberostar: {
        name: 'Iberostar',
        aliases: ['iberostar', 'iberoestars', 'ibero star', 'iberostar hotels']
    },
    melia: {
        name: 'Melia',
        aliases: ['melia', 'meliá', 'sol melia', 'sol meliá', 'melia hotels', 'me by melia', 'innside by melia', 'tryp']
    },
    bahia_principe: {
        name: 'Bahia Principe',
        aliases: ['bahia principe', 'bahía príncipe', 'bahia', 'bahía', 'grand bahia principe', 'luxury bahia principe']
    },
    barcelo: {
        name: 'Barcelo',
        aliases: ['barcelo', 'barceló', 'barcelo hotels', 'occidental', 'occidental hotels']
    },
    nh: {
        name: 'NH Hotels',
        aliases: ['nh', 'nh hotels', 'nh hoteles', 'nh collection']
    },
    hilton: {
        name: 'Hilton',
        aliases: ['hilton', 'hilton hotels', 'doubletree', 'doubletree by hilton', 'hampton inn', 'hampton', 'embassy suites', 'waldorf astoria', 'conrad']
    },
    marriott: {
        name: 'Marriott',
        aliases: ['marriott', 'marriot', 'marriott hotels', 'courtyard', 'courtyard by marriott', 'sheraton', 'westin', 'w hotels', 'le meridien', 'st regis', 'ritz carlton', 'ritz-carlton']
    },
    hyatt: {
        name: 'Hyatt',
        aliases: ['hyatt', 'hyatt hotels', 'hyatt regency', 'grand hyatt', 'park hyatt', 'andaz']
    },
    accor: {
        name: 'Accor',
        aliases: ['accor', 'accor hotels', 'novotel', 'ibis', 'sofitel', 'pullman', 'mercure', 'fairmont']
    },
    sunscape: {
        name: 'Sunscape',
        aliases: ['sunscape', 'sunscape resorts', 'sunscape coco']
    },
    hard_rock: {
        name: 'Hard Rock',
        aliases: ['hard rock', 'hardrock', 'hard rock hotel', 'hard rock hotels', 'hard rock cafe hotel']
    },
    excellence: {
        name: 'Excellence',
        aliases: ['excellence', 'excellence resorts', 'excellence playa mujeres', 'excellence riviera cancun']
    },
    secrets: {
        name: 'Secrets',
        aliases: ['secrets', 'secrets resorts', 'secrets hotels', 'secrets the vine']
    },
    dreams: {
        name: 'Dreams',
        aliases: ['dreams', 'dreams resorts', 'dreams hotels']
    },
    palace_resorts: {
        name: 'Palace Resorts',
        aliases: ['palace', 'palace resorts', 'moon palace', 'le blanc', 'leblanc']
    },
    sandals: {
        name: 'Sandals',
        aliases: ['sandals', 'sandals resorts', 'beaches resorts', 'beaches']
    },
    club_med: {
        name: 'Club Med',
        aliases: ['club med', 'clubmed', 'club mediterranee']
    },
    intercontinental: {
        name: 'InterContinental',
        aliases: ['intercontinental', 'inter continental', 'ihg', 'holiday inn', 'crowne plaza', 'indigo', 'hotel indigo', 'even hotels']
    },
    wyndham: {
        name: 'Wyndham',
        aliases: ['wyndham', 'wyndham hotels', 'ramada', 'days inn', 'super 8', 'la quinta']
    },
    best_western: {
        name: 'Best Western',
        aliases: ['best western', 'bestwestern']
    },
    radisson: {
        name: 'Radisson',
        aliases: ['radisson', 'radisson blu', 'radisson red', 'park inn', 'park inn by radisson']
    },
    lopesan: {
        name: 'Lopesan',
        aliases: ['lopesan', 'lopesan hotels', 'lopesan costa meloneras']
    },
    fiesta: {
        name: 'Fiesta Hotels',
        aliases: ['fiesta', 'fiesta hotels', 'fiesta americana', 'fiesta inn']
    },
    oasis: {
        name: 'Oasis Hotels',
        aliases: ['oasis', 'oasis hotels', 'grand oasis', 'oasis palm']
    },
    royalton: {
        name: 'Royalton',
        aliases: ['royalton', 'royalton resorts', 'royalton luxury resorts']
    },
    breathless: {
        name: 'Breathless',
        aliases: ['breathless', 'breathless resorts']
    },
    now_resorts: {
        name: 'Now Resorts',
        aliases: ['now resorts', 'now hotels', 'now jade', 'now amber', 'now sapphire']
    },
    catalonia: {
        name: 'Catalonia',
        aliases: ['catalonia', 'catalonia hotels']
    },
    princess: {
        name: 'Princess Hotels',
        aliases: ['princess', 'princess hotels', 'grand princess']
    },
    lti: {
        name: 'LTI Hotels',
        aliases: ['lti', 'lti hotels']
    }
};

/**
 * Normalizes text for comparison: lowercase, no accents, trimmed
 */
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim();
}

/**
 * Detects if a hotel chain is mentioned in the text
 * 
 * @param text - The user's message
 * @returns The detected chain info or null
 * 
 * @example
 * detectHotelChainInText("quiero un hotel de la cadena Riu")
 * // Returns: { key: 'riu', name: 'RIU', matchedAlias: 'riu' }
 */
export function detectHotelChainInText(text: string): { key: string; name: string; matchedAlias: string } | null {
    const normalizedText = normalizeText(text);

    // Pattern 1: "cadena [nombre]" or "chain [nombre]"
    const chainPatternMatch = normalizedText.match(/(?:cadena|chain|de la cadena)\s+([a-z\s]+?)(?:\s|$|,|\.|habitacion|all|todo|doble|simple|triple)/);
    if (chainPatternMatch) {
        const potentialChain = chainPatternMatch[1].trim();
        const foundChain = findChainByAlias(potentialChain);
        if (foundChain) {
            console.log(`🏨 [CHAIN DETECT] Pattern match "cadena X": "${potentialChain}" → ${foundChain.name}`);
            return foundChain;
        }
    }

    // Pattern 2: "hoteles [nombre]" or "hotel [nombre]" where nombre is a known chain
    const hotelPatternMatch = normalizedText.match(/(?:hoteles?)\s+([a-z\s]+?)(?:\s|$|,|\.|en\s|para\s|all|todo|doble)/);
    if (hotelPatternMatch) {
        const potentialChain = hotelPatternMatch[1].trim();
        const foundChain = findChainByAlias(potentialChain);
        if (foundChain) {
            console.log(`🏨 [CHAIN DETECT] Pattern match "hotel X": "${potentialChain}" → ${foundChain.name}`);
            return foundChain;
        }
    }

    // Pattern 3: Direct chain name mention (longest match first to avoid partial matches)
    // Sort chains by alias length (descending) to match longer aliases first
    const allAliases: { key: string; alias: string; chain: HotelChainInfo }[] = [];
    for (const [key, chain] of Object.entries(HOTEL_CHAINS)) {
        for (const alias of chain.aliases) {
            allAliases.push({ key, alias, chain });
        }
    }
    // Sort by alias length descending
    allAliases.sort((a, b) => b.alias.length - a.alias.length);

    for (const { key, alias, chain } of allAliases) {
        // Use word boundaries to avoid partial matches
        const aliasRegex = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        if (aliasRegex.test(normalizedText)) {
            console.log(`🏨 [CHAIN DETECT] Direct match: "${alias}" → ${chain.name}`);
            return { key, name: chain.name, matchedAlias: alias };
        }
    }

    return null;
}

/**
 * Finds a chain by any of its aliases
 */
function findChainByAlias(input: string): { key: string; name: string; matchedAlias: string } | null {
    const normalizedInput = normalizeText(input);

    for (const [key, chain] of Object.entries(HOTEL_CHAINS)) {
        for (const alias of chain.aliases) {
            if (normalizeText(alias) === normalizedInput || normalizedInput.includes(normalizeText(alias))) {
                return { key, name: chain.name, matchedAlias: alias };
            }
        }
    }

    return null;
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Normalizes a hotel chain name to canonical form
 * 
 * @param input - User-provided chain name
 * @returns Canonical chain name or original if not found
 * 
 * @example
 * normalizeHotelChainName("riu") // Returns "RIU"
 * normalizeHotelChainName("meliá") // Returns "Melia"
 */
export function normalizeHotelChainName(input: string): string {
    const normalizedInput = normalizeText(input);

    for (const chain of Object.values(HOTEL_CHAINS)) {
        for (const alias of chain.aliases) {
            if (normalizeText(alias) === normalizedInput) {
                return chain.name;
            }
        }
    }

    // Return original input with first letter capitalized if not found
    return input.charAt(0).toUpperCase() + input.slice(1).toLowerCase();
}

/**
 * Checks if a hotel name belongs to a specific chain
 * Uses flexible matching with normalization
 * 
 * @param hotelName - Full hotel name from API (e.g., "RIU BAMBU")
 * @param chainName - Chain to check (e.g., "RIU", "riu", "Riu")
 * @returns true if hotel belongs to the chain
 * 
 * @example
 * hotelBelongsToChain("RIU BAMBU", "riu") // Returns true
 * hotelBelongsToChain("IBEROSTAR DOMINICANA", "riu") // Returns false
 */
export function hotelBelongsToChain(hotelName: string, chainName: string): boolean {
    const normalizedHotelName = normalizeText(hotelName);
    const normalizedChainName = normalizeText(chainName);

    // Direct match
    if (normalizedHotelName.includes(normalizedChainName)) {
        return true;
    }

    // Check all aliases of the chain
    for (const chain of Object.values(HOTEL_CHAINS)) {
        const isTargetChain = chain.aliases.some(alias =>
            normalizeText(alias) === normalizedChainName ||
            normalizedChainName.includes(normalizeText(chain.name.toLowerCase()))
        );

        if (isTargetChain) {
            // Check if hotel name contains any alias of this chain
            return chain.aliases.some(alias =>
                normalizedHotelName.includes(normalizeText(alias))
            ) || normalizedHotelName.includes(normalizeText(chain.name));
        }
    }

    return false;
}

/**
 * Checks if a hotel name matches a specific hotel name filter
 * Uses flexible matching with normalization
 * 
 * @param hotelName - Full hotel name from API (e.g., "RIU BAMBU")
 * @param nameFilter - Partial or full name to match (e.g., "bambu", "riu bambu")
 * @returns true if hotel name matches the filter
 * 
 * @example
 * hotelNameMatches("RIU BAMBU", "bambu") // Returns true
 * hotelNameMatches("RIU BAMBU", "riu bambu") // Returns true
 * hotelNameMatches("RIU BAMBU", "palace") // Returns false
 */
export function hotelNameMatches(hotelName: string, nameFilter: string): boolean {
    const normalizedHotelName = normalizeText(hotelName);
    const normalizedFilter = normalizeText(nameFilter);

    // Split filter into words and check if all words are present
    const filterWords = normalizedFilter.split(/\s+/).filter(w => w.length > 0);

    return filterWords.every(word => normalizedHotelName.includes(word));
}

// =====================================================================
// PRE-PARSER: DETERMINISTIC HOTEL/CHAIN EXTRACTION FROM USER TEXT
// =====================================================================

/**
 * Result of the hotel/chain pre-parser
 */
export interface HotelPreParserResult {
    hotelChain?: string;      // Detected chain name (canonical form)
    hotelName?: string;       // Detected specific hotel name (if any)
    rawChainMatch?: string;   // Raw text that matched as chain
    rawNameMatch?: string;    // Raw text that matched as hotel name
    confidence: number;       // 0-1 confidence score
}

/**
 * 🏨 PRE-PARSER: Deterministic extraction of hotel CHAIN from user text
 * 
 * This function is called BEFORE the AI Parser to extract hotel chain info
 * using deterministic regex patterns. Results are passed to AI as hints
 * and used as fallback if AI doesn't detect them.
 * 
 * IMPORTANT: This pre-parser ONLY detects chains using the explicit pattern "cadena X".
 * It does NOT attempt to detect specific hotel names (hotelName) - that is left to the AI Parser.
 * 
 * FLOW:
 * 1. Pre-parser extracts hotelChain from user text using "cadena X" pattern (this function)
 * 2. Results passed to AI Parser as context hints
 * 3. AI Parser processes message with hints (AI can also detect hotelName if mentioned)
 * 4. If AI doesn't detect chain but pre-parser did, pre-parser value is used
 * 5. Post-search filtering uses hotelChain to filter hotel.name via hotelBelongsToChain()
 * 
 * @param text - User's message (e.g., "quiero hotel de la cadena riu all inclusive")
 * @returns Extracted hotel chain with confidence score (hotelName is always undefined)
 * 
 * @example
 * extractHotelInfoFromText("quiero un hotel de la cadena Riu habitacion doble")
 * // Returns: { hotelChain: "RIU", confidence: 0.95 }
 * 
 * @example
 * extractHotelInfoFromText("hotel en Cancun para 2 personas")
 * // Returns: { confidence: 0 } (no chain pattern found)
 */
export function extractHotelInfoFromText(text: string): HotelPreParserResult {
    const normalizedText = normalizeText(text);
    const result: HotelPreParserResult = { confidence: 0 };

    console.log(`🏨 [PRE-PARSER] Analyzing text for hotel chain: "${text.substring(0, 100)}..."`);

    // =========================================================================
    // ONLY PATTERN: "cadena [nombre]" / "de la cadena [nombre]" / "chain [nombre]"
    // 
    // This is the ONLY pattern we use for deterministic chain detection.
    // We capture the text immediately after "cadena" until:
    // - A comma, period, or end of string
    // - Common hotel-related words (habitacion, all, todo, doble, etc.)
    // 
    // This avoids false positives from patterns like "hotel para las mismas fechas"
    // =========================================================================

    // Regex explanation:
    // - (?:de la cadena|cadena|chain) - match "cadena", "de la cadena", or "chain"
    // - \s+ - one or more spaces
    // - ([a-z][a-z\s]*?) - capture group: starts with letter, then letters/spaces (non-greedy)
    // - (?=\s+(?:habitacion|all|todo|doble|simple|triple|para|en|con)|[,.]|$) - lookahead: stop before these words or punctuation
    const cadenaPattern = /(?:de la cadena|cadena|chain)\s+([a-z][a-z\s]*?)(?=\s+(?:habitacion|all|todo|doble|simple|triple|para|en|con)|[,.]|$)/i;

    const match = normalizedText.match(cadenaPattern);
    if (match && match[1]) {
        const extractedName = match[1].trim();

        // Skip if extracted name is empty or too short
        if (extractedName.length < 2) {
            console.log(`⚠️ [PRE-PARSER] Extracted chain name too short: "${extractedName}"`);
            return result;
        }

        console.log(`🏨 [PRE-PARSER] Pattern "cadena X" matched: "${extractedName}"`);

        // Try to find in known chains for canonical name
        const chainInfo = findChainByAlias(extractedName);
        if (chainInfo) {
            result.hotelChain = chainInfo.name;
            result.rawChainMatch = extractedName;
            result.confidence = 0.95;
            console.log(`✅ [PRE-PARSER] Matched known chain: "${extractedName}" → ${chainInfo.name}`);
        } else {
            // Even if not in known chains, use the extracted name (user might know a chain we don't)
            // Capitalize first letter of each word
            result.hotelChain = extractedName
                .split(/\s+/)
                .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                .join(' ');
            result.rawChainMatch = extractedName;
            result.confidence = 0.8;
            console.log(`⚠️ [PRE-PARSER] Unknown chain, using raw: "${extractedName}" → "${result.hotelChain}"`);
        }
    }

    // Log final result
    if (result.hotelChain) {
        console.log(`✅ [PRE-PARSER] Final result:`, {
            hotelChain: result.hotelChain,
            confidence: result.confidence
        });
    } else {
        console.log(`ℹ️ [PRE-PARSER] No chain detected (no "cadena X" pattern found)`);
    }

    // NOTE: hotelName is intentionally NOT set by the pre-parser.
    // The AI Parser handles hotelName detection to avoid false positives.
    return result;
}

/**
 * Detect MULTIPLE hotel chains in text with separators support
 *
 * Supports: "cadena riu y iberostar", "hoteles riu, iberostar o melia", etc.
 *
 * @param text - User input text
 * @returns Array of detected chain names (canonical form)
 *
 * @example
 * detectMultipleHotelChains("cadena riu y iberostar") → ["RIU", "Iberostar"]
 * detectMultipleHotelChains("hoteles riu, melia o barcelo") → ["RIU", "Melia", "Barcelo"]
 * detectMultipleHotelChains("hotel en cancun") → []
 */
export function detectMultipleHotelChains(text: string): string[] {
    const normalizedText = text.toLowerCase().trim();
    const detectedChains: string[] = [];

    console.log(`🏨 [MULTI-CHAIN] Detecting chains in: "${text}"`);

    // Pattern 1: "cadena X y Y" or "cadenas X, Y, Z"
    const chainPatterns = [
        /(?:cadena|cadenas|chain|chains)\s+([^.?!]+)/gi,
        /hoteles?\s+([a-záéíóúñü\s,\/&y]+?)(?:\s+(?:en|de|para|habitaci[oó]n|doble|triple|todo|all|con|desayuno)|\.|,|$)/gi
    ];

    for (const pattern of chainPatterns) {
        const matches = [...normalizedText.matchAll(pattern)];
        if (matches.length > 0) {
            for (const match of matches) {
                const capturedText = match[1].trim();
                console.log(`🔍 [MULTI-CHAIN] Pattern matched: "${capturedText}"`);

                // Split by separators: y, e, o, or, and, comas, slash, ampersand
                const separators = /\s+(?:y|e|o|or|and)\s+|,\s*|\/|&/gi;
                const parts = capturedText.split(separators).map(p => p.trim()).filter(p => p.length > 0);

                console.log(`📋 [MULTI-CHAIN] Split into parts:`, parts);

                for (const part of parts) {
                    // Try to find in known chains
                    const chainInfo = findChainByAlias(part);
                    if (chainInfo) {
                        if (!detectedChains.includes(chainInfo.name)) {
                            detectedChains.push(chainInfo.name);
                            console.log(`✅ [MULTI-CHAIN] Matched known chain: "${part}" → ${chainInfo.name}`);
                        }
                    } else {
                        // Check if it might be a partial chain name
                        const maybeChain = part
                            .split(/\s+/)
                            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                            .join(' ');

                        // Only add if it looks like a chain name (2-20 chars, not common words)
                        const commonWords = ['hotel', 'hoteles', 'habitacion', 'doble', 'triple', 'todo', 'incluido', 'inclusive', 'con', 'sin', 'para', 'en', 'de', 'la', 'el'];
                        if (maybeChain.length >= 2 && maybeChain.length <= 20 && !commonWords.includes(part.toLowerCase())) {
                            if (!detectedChains.includes(maybeChain)) {
                                detectedChains.push(maybeChain);
                                console.log(`⚠️ [MULTI-CHAIN] Unknown chain, using raw: "${part}" → "${maybeChain}"`);
                            }
                        }
                    }
                }
            }
        }
    }

    // Pattern 2: Direct chain mentions without "cadena" keyword
    // Only if no chains detected yet (to avoid false positives)
    if (detectedChains.length === 0) {
        const detection = detectHotelChainInText(text);
        if (detection && detection.name) {
            detectedChains.push(detection.name);
            console.log(`✅ [MULTI-CHAIN] Fallback detection: ${detection.name}`);
        }
    }

    console.log(`🏁 [MULTI-CHAIN] Final result:`, detectedChains);
    return detectedChains;
}

/**
 * Check if a hotel belongs to ANY of the specified chains
 *
 * @param hotelName - Hotel name to check
 * @param chains - Array of chain names to check against
 * @returns true if hotel belongs to any chain in the array
 *
 * @example
 * hotelBelongsToAnyChain("RIU Bambu", ["RIU", "Iberostar"]) → true
 * hotelBelongsToAnyChain("Hard Rock Cancun", ["RIU", "Iberostar"]) → false
 */
export function hotelBelongsToAnyChain(hotelName: string, chains: string[]): boolean {
    if (!chains || chains.length === 0) {
        return true; // No filter, all hotels match
    }

    for (const chain of chains) {
        if (hotelBelongsToChain(hotelName, chain)) {
            return true; // Match found
        }
    }

    return false; // No match
}


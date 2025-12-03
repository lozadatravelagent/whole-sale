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
 * 🏨 PRE-PARSER: Deterministic extraction of hotel chain and name from user text
 * 
 * This function is called BEFORE the AI Parser to extract hotel/chain info
 * using deterministic regex patterns. Results are passed to AI as hints
 * and used as fallback if AI doesn't detect them.
 * 
 * FLOW:
 * 1. Pre-parser extracts hotelChain/hotelName from user text (this function)
 * 2. Results passed to AI Parser as context hints
 * 3. AI Parser processes message with hints
 * 4. If AI doesn't detect chain/name but pre-parser did, pre-parser values are used
 * 5. Post-search filtering uses final hotelChain/hotelName to filter hotel.name
 * 
 * @param text - User's message (e.g., "quiero hotel de la cadena riu bambu all inclusive")
 * @returns Extracted hotel chain and/or name with confidence score
 * 
 * @example
 * extractHotelInfoFromText("quiero un hotel de la cadena Riu habitacion doble")
 * // Returns: { hotelChain: "RIU", confidence: 0.95 }
 * 
 * @example
 * extractHotelInfoFromText("en el hotel Riu Bambu para 2 personas")
 * // Returns: { hotelChain: "RIU", hotelName: "Riu Bambu", confidence: 0.95 }
 */
export function extractHotelInfoFromText(text: string): HotelPreParserResult {
    const normalizedText = normalizeText(text);
    const result: HotelPreParserResult = { confidence: 0 };

    console.log(`🏨 [PRE-PARSER] Analyzing text for hotel/chain: "${text.substring(0, 100)}..."`);

    // =========================================================================
    // PATTERN 1: "cadena [nombre]" / "de la cadena [nombre]" / "chain [nombre]"
    // This is the most explicit pattern - highest confidence (0.95)
    // =========================================================================
    const cadenaPatterns = [
        /(?:de la cadena|cadena|chain)\s+([a-z][a-z\s]{1,30}?)(?:\s+(?:habitacion|all|todo|doble|simple|triple|para|en|con|$)|[,.]|$)/i,
    ];

    for (const pattern of cadenaPatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
            const extractedName = match[1].trim();
            console.log(`🏨 [PRE-PARSER] Pattern "cadena X" matched: "${extractedName}"`);

            // Try to find in known chains
            const chainInfo = findChainByAlias(extractedName);
            if (chainInfo) {
                result.hotelChain = chainInfo.name;
                result.rawChainMatch = extractedName;
                result.confidence = 0.95;
                console.log(`✅ [PRE-PARSER] Matched known chain: "${extractedName}" → ${chainInfo.name}`);
            } else {
                // Even if not in known chains, use the extracted name (user might know a chain we don't)
                result.hotelChain = extractedName.charAt(0).toUpperCase() + extractedName.slice(1);
                result.rawChainMatch = extractedName;
                result.confidence = 0.8;
                console.log(`⚠️ [PRE-PARSER] Unknown chain, using raw: "${extractedName}"`);
            }
            break;
        }
    }

    // =========================================================================
    // PATTERN 2: "hotel [nombre específico]" / "en el hotel [nombre]"
    // Captures specific hotel names (e.g., "hotel Riu Bambu", "en el hotel Iberostar Dominicana")
    // =========================================================================
    const hotelNamePatterns = [
        /(?:en el hotel|hotel)\s+([a-z][a-z\s]{2,40}?)(?:\s+(?:habitacion|all|todo|doble|simple|triple|para|en\s+(?:punta|cancun|madrid)|con|$)|[,.]|$)/i,
        /(?:el|un|quiero el|reservar el)\s+([a-z][a-z\s]{2,40}?)(?:\s+(?:habitacion|all|todo|doble|simple|triple|para|en\s+|con|$)|[,.]|$)/i,
    ];

    // Only try hotel name patterns if we haven't found a chain yet OR to find specific name
    for (const pattern of hotelNamePatterns) {
        const match = normalizedText.match(pattern);
        if (match && match[1]) {
            const extractedName = match[1].trim();

            // Skip if it's just a city name or too short
            if (extractedName.length < 3) continue;
            const cityNames = ['cancun', 'punta cana', 'madrid', 'barcelona', 'miami', 'paris', 'roma', 'riviera maya'];
            if (cityNames.some(city => normalizeText(extractedName) === city)) continue;

            console.log(`🏨 [PRE-PARSER] Pattern "hotel X" matched: "${extractedName}"`);

            // Check if this looks like a specific hotel (chain + name) or just a chain
            const words = extractedName.split(/\s+/);
            const firstWord = words[0];
            const chainInfo = findChainByAlias(firstWord);

            if (chainInfo && words.length > 1) {
                // It's a specific hotel: "Riu Bambu", "Iberostar Dominicana"
                result.hotelName = extractedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                result.rawNameMatch = extractedName;
                if (!result.hotelChain) {
                    result.hotelChain = chainInfo.name;
                    result.rawChainMatch = firstWord;
                }
                result.confidence = Math.max(result.confidence, 0.9);
                console.log(`✅ [PRE-PARSER] Specific hotel detected: "${result.hotelName}" (chain: ${result.hotelChain})`);
                break;
            } else if (chainInfo && words.length === 1) {
                // It's just a chain name mentioned with "hotel": "hotel Riu"
                if (!result.hotelChain) {
                    result.hotelChain = chainInfo.name;
                    result.rawChainMatch = extractedName;
                    result.confidence = Math.max(result.confidence, 0.85);
                    console.log(`✅ [PRE-PARSER] Chain from "hotel X" pattern: ${chainInfo.name}`);
                }
            } else if (words.length > 1) {
                // Unknown chain but specific name: might be a hotel we don't know
                result.hotelName = extractedName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                result.rawNameMatch = extractedName;
                result.confidence = Math.max(result.confidence, 0.7);
                console.log(`⚠️ [PRE-PARSER] Unknown specific hotel: "${result.hotelName}"`);
                break;
            }
        }
    }

    // =========================================================================
    // PATTERN 3: Direct chain name mention without "cadena" or "hotel" prefix
    // Lower confidence (0.7) since it might be coincidental
    // Only if we haven't found anything yet
    // =========================================================================
    if (!result.hotelChain && result.confidence < 0.5) {
        const chainDetection = detectHotelChainInText(text);
        if (chainDetection) {
            result.hotelChain = chainDetection.name;
            result.rawChainMatch = chainDetection.matchedAlias;
            result.confidence = 0.7;
            console.log(`🏨 [PRE-PARSER] Direct chain mention: "${chainDetection.matchedAlias}" → ${chainDetection.name}`);
        }
    }

    // Log final result
    if (result.hotelChain || result.hotelName) {
        console.log(`✅ [PRE-PARSER] Final result:`, {
            hotelChain: result.hotelChain,
            hotelName: result.hotelName,
            confidence: result.confidence
        });
    } else {
        console.log(`ℹ️ [PRE-PARSER] No hotel/chain detected in text`);
    }

    return result;
}


import { parsePrice } from './pdfParsingUtils';

/**
 * Extract price from user message
 */
export function extractPriceFromMessage(message: string): number | null {
    const pricePatterns = [
        /(?:cambia|cambiar|modifica|modificar|actualiza|actualizar|ajusta|ajustar|pon|poner)(?:\s+el)?\s+precio\s+total\s+(?:a|en|por)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /precio\s+total\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /total\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /(?:opci[oó]n|opcion)\s+[12]\s+(?:a|en)\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /(?:cambia|cambiar|modifica|modificar|actualiza|actualizar|ajusta|ajustar|pon|poner)(?:\s+el)?\s+precio\s+(?:a|en|por)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /precio\s+(?:a|en|por|de)?\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /\$\s*(\d{1,10}(?:[.,]\d{1,3})+|\d+)/g,
        /(\d{1,10}(?:[.,]\d{1,3})+|\d+)\s*(?:USD|usd|dólares?|dolares?)/gi,
        /cambia.*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi,
        /por\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi
    ];

    for (const pattern of pricePatterns) {
        const matches = [...message.matchAll(pattern)];
        if (matches.length > 0) {
            for (const match of matches) {
                const priceStr = match[1];
                if (priceStr) {
                    const price = parsePrice(priceStr);
                    if (price > 0 && price < 100000) {
                        console.log('💰 [PRICE EXTRACTION] Found price with context:', price, 'from match:', match[0], 'raw:', priceStr);
                        return price;
                    }
                }
            }
        }
    }

    const standalonePattern = /\b(\d{1,10}(?:[.,]\d{3})+|\d{3,6})\b/g;
    const standaloneMatches = message.match(standalonePattern);

    if (standaloneMatches) {
        console.log('💰 [PRICE EXTRACTION] Found standalone matches:', standaloneMatches);

        const parsedPrices = standaloneMatches
            .map(numStr => {
                const price = parsePrice(numStr);
                console.log('💰 [PRICE EXTRACTION] Parsing standalone:', numStr, '→', price);
                return price;
            })
            .filter(price => price >= 100 && price <= 50000);

        if (parsedPrices.length > 0) {
            const maxPrice = Math.max(...parsedPrices);
            console.log('💰 [PRICE EXTRACTION] Found standalone number:', maxPrice);
            return maxPrice;
        }
    }

    console.log('💰 [PRICE EXTRACTION] No price found in message:', message);
    return null;
}

/**
 * Extract multiple prices with positions from message
 */
export function extractMultiplePricesFromMessage(message: string): Array<{ position: number, price: number }> | null {
    console.log('🔍 [MULTIPLE PRICES V6] Extracting multiple prices from:', message);
    const normalizedMessage = message.toLowerCase();
    const priceChanges: Array<{ position: number, price: number }> = [];

    const positionMapping: Record<string, number> = {
        'primer': 1, 'primera': 1, 'primero': 1,
        'segund': 2, 'segundo': 2, 'segunda': 2,
        'tercer': 3, 'tercera': 3, 'tercero': 3,
        'cuart': 4, 'cuarto': 4, 'cuarta': 4,
        '1': 1, '2': 2, '3': 3, '4': 4
    };

    // Strategy 1: Look for explicit "al [position] [price]" patterns
    const explicitPattern = /al\s+(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4])\s+(?:vuelo\s+)?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi;
    let explicitMatches = [...normalizedMessage.matchAll(explicitPattern)];

    console.log('🔍 [EXPLICIT PATTERN] Found matches:', explicitMatches.length);

    for (const match of explicitMatches) {
        console.log(`🔍 [EXPLICIT] Processing match: "${match[0]}"`, match);
        const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
        const position = positionMapping[positionStr] || parseInt(positionStr);
        const priceStr = match[2];

        console.log(`🔍 [EXPLICIT] Parsed - position: ${position}, priceStr: "${priceStr}"`);

        if (position > 0 && priceStr) {
            const price = parsePrice(priceStr);
            console.log(`🔍 [EXPLICIT] Price value: ${price}, valid range: ${price >= 100 && price <= 50000}`);

            if (price >= 100 && price <= 50000) {
                const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                console.log(`🔍 [EXPLICIT] Existing index for position ${position}: ${existingIndex}`);

                if (existingIndex === -1) {
                    priceChanges.push({ position, price });
                    console.log(`💰 [EXPLICIT] Position ${position}: $${price} from "${match[0]}"`);
                } else {
                    console.log(`⚠️ [EXPLICIT] Skipped duplicate position ${position}`);
                }
            } else {
                console.log(`⚠️ [EXPLICIT] Price ${price} out of range [100, 50000]`);
            }
        } else {
            console.log(`⚠️ [EXPLICIT] Invalid position (${position}) or priceStr ("${priceStr}")`);
        }
    }

    // Strategy 2: Look for "precio [position] [price]" patterns
    const pricePositionPattern = /precio\s+(?:al\s+)?(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4])\s+(\d{1,10}(?:[.,]\d{1,3})+|\d+)/gi;
    let pricePositionMatches = [...normalizedMessage.matchAll(pricePositionPattern)];

    console.log('🔍 [PRICE POSITION PATTERN] Found matches:', pricePositionMatches.length);

    for (const match of pricePositionMatches) {
        const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
        const position = positionMapping[positionStr] || parseInt(positionStr);
        const priceStr = match[2];

        if (position > 0 && priceStr) {
            const price = parsePrice(priceStr);
            if (price >= 100 && price <= 50000) {
                const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                if (existingIndex === -1) {
                    priceChanges.push({ position, price });
                    console.log(`💰 [PRICE POSITION] Position ${position}: $${price} from "${match[0]}"`);
                }
            }
        }
    }

    // Strategy 3: Original clause-based pattern (fallback)
    const clauses = normalizedMessage.split(/\s+y\s+|,\s*/);
    console.log('🔍 [CLAUSE SPLIT] Clauses:', clauses);

    const clausePattern = /(primer[ao]?|primero|segundo?[ao]?|tercer[ao]?|tercero|cuarto?[ao]?|[1-4]).*?(\d{1,10}(?:[.,]\d{1,3})+|\d+)/i;

    for (const rawClause of clauses) {
        const clause = rawClause.trim();
        if (!clause) continue;

        const match = clause.match(clausePattern);

        if (match) {
            const positionStr = match[1].toLowerCase().replace(/[ao]$/, '');
            const position = positionMapping[positionStr] || parseInt(positionStr);
            const priceStr = match[2];

            if (position >= 1 && position <= 4 && /^[1-4]$/.test(positionStr)) {
                const positionIndex = clause.indexOf(positionStr);
                const nextChar = clause[positionIndex + 1];

                if (nextChar === '.' && /^\d{3}/.test(clause.substring(positionIndex + 2))) {
                    console.log(`⚠️ [CLAUSE] Skipping - "${positionStr}" is part of Latino number format (e.g., ${positionStr}.XXX)`);
                    continue;
                }

                if (nextChar && /\d/.test(nextChar)) {
                    console.log(`⚠️ [CLAUSE] Skipping - "${positionStr}" is part of complete number (e.g., ${positionStr}${nextChar}...)`);
                    continue;
                }

                if (/\b(precio|total|cuesta|cueste)\s+a\s+[1-4][\.\d]/.test(clause)) {
                    console.log(`⚠️ [CLAUSE] Skipping - detected "precio/total a X..." pattern`);
                    continue;
                }
            }

            if (position > 0 && priceStr) {
                const price = parsePrice(priceStr);
                if (price >= 100 && price <= 50000) {
                    const existingIndex = priceChanges.findIndex(pc => pc.position === position);
                    if (existingIndex === -1) {
                        priceChanges.push({ position, price });
                        console.log(`💰 [CLAUSE] Position ${position}: $${price} from clause "${clause}"`);
                    }
                }
            }
        }
    }

    priceChanges.sort((a, b) => a.position - b.position);

    if (priceChanges.length > 0) {
        console.log('✅ [MULTIPLE PRICES] Total extracted:', priceChanges.length, priceChanges);
        return priceChanges;
    }

    console.log('❌ [MULTIPLE PRICES] No positional prices found');
    return null;
}

/**
 * Extract dual option price changes (opción 1 AND opción 2 in the same message)
 */
export function extractDualOptionPrices(message: string): { option1Price: number; option2Price: number; option3Price?: number } | null {
    console.log('🔄 [MULTI OPTIONS] Checking for multiple option price changes:', message);

    const option1Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /primera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    const option2Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /segunda?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    const option3Patterns = [
        /(?:el\s+)?precio\s+de\s+(?:la\s+)?opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /(?:la\s+)?opci[oó]n\s+3\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
        /tercera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i,
    ];

    let option1Price: number | null = null;
    let option2Price: number | null = null;
    let option3Price: number | null = null;

    for (const pattern of option1Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option1Price = price;
                console.log('💰 [MULTI OPTIONS] Option 1 price found:', price);
                break;
            }
        }
    }

    for (const pattern of option2Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option2Price = price;
                console.log('💰 [MULTI OPTIONS] Option 2 price found:', price);
                break;
            }
        }
    }

    for (const pattern of option3Patterns) {
        const match = message.match(pattern);
        if (match) {
            const price = parsePrice(match[1]);
            if (price >= 100 && price <= 50000) {
                option3Price = price;
                console.log('💰 [MULTI OPTIONS] Option 3 price found:', price);
                break;
            }
        }
    }

    if (option1Price !== null && option2Price !== null) {
        const result: { option1Price: number; option2Price: number; option3Price?: number } = {
            option1Price,
            option2Price
        };
        if (option3Price !== null) {
            result.option3Price = option3Price;
        }
        console.log('✅ [MULTI OPTIONS] Multiple options found:', result);
        return result;
    }

    console.log('❌ [MULTI OPTIONS] Not a multi-option change (found only one or none)');
    return null;
}

/**
 * Extract multiple hotel prices from message
 */
export function extractMultipleHotelPricesFromMessage(
    message: string,
    hotels: Array<{ name: string; price: number; nights?: number }>
): Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }> {
    console.log('🏨 [MULTIPLE HOTEL PRICES] Extracting from:', message);
    console.log('🏨 [MULTIPLE HOTEL PRICES] Hotels available:', hotels.length);

    const changes: Array<{ hotelIndex: number; hotelName?: string; referenceType: 'position' | 'name' | 'price_order'; newPrice: number }> = [];
    const norm = message.toLowerCase();

    if (hotels.length === 0) {
        console.log('❌ [MULTIPLE HOTEL PRICES] No hotels available');
        return changes;
    }

    const sortedByPrice = [...hotels].sort((a, b) => a.price - b.price);

    // Pattern 0: By package option
    const optionPatterns = [
        { regex: /opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /primera?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /segunda?\s+opci[oó]n\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /la\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /la\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /(?:el\s+)?precio\s+de\s+la\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /(?:el\s+)?precio\s+de\s+la\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /(?:el\s+)?precio\s+de\s+opci[oó]n\s+1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /(?:el\s+)?precio\s+de\s+opci[oó]n\s+2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
    ];

    for (const { regex, position } of optionPatterns) {
        const match = message.match(regex);
        if (match && position <= hotels.length) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                const existingChange = changes.find(c => c.hotelIndex === position - 1);
                if (!existingChange) {
                    changes.push({
                        hotelIndex: position - 1,
                        referenceType: 'position',
                        newPrice
                    });
                    console.log(`💰 [OPTION PRICE] Opción ${position}: $${newPrice}`);
                }
            }
        }
    }

    // Pattern 1: By position
    const positionPatterns = [
        { regex: /primer(?:o)?\s+hotel\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /segundo?\s+hotel\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
        { regex: /hotel\s+(?:#|n[uú]mero?\s*)1\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 1 },
        { regex: /hotel\s+(?:#|n[uú]mero?\s*)2\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, position: 2 },
    ];

    for (const { regex, position } of positionPatterns) {
        const match = message.match(regex);
        if (match && position <= hotels.length) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                const existingChange = changes.find(c => c.hotelIndex === position - 1);
                if (!existingChange) {
                    changes.push({
                        hotelIndex: position - 1,
                        referenceType: 'position',
                        newPrice
                    });
                    console.log(`💰 [HOTEL POSITION] Hotel ${position}: $${newPrice}`);
                }
            }
        }
    }

    // Pattern 2: By price order
    const priceOrderPatterns = [
        { regex: /(?:el\s+)?m[aá]s\s+barato\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'cheapest' as const },
        { regex: /(?:el\s+)?m[aá]s\s+caro\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'expensive' as const },
        { regex: /(?:el\s+)?econ[oó]mico\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/i, order: 'cheapest' as const },
    ];

    for (const { regex, order } of priceOrderPatterns) {
        const match = message.match(regex);
        if (match) {
            const newPrice = parsePrice(match[1]);
            if (newPrice >= 100 && newPrice <= 50000) {
                const targetHotel = order === 'cheapest' ? sortedByPrice[0] : sortedByPrice[sortedByPrice.length - 1];
                const originalIndex = hotels.findIndex(h => h.name === targetHotel.name);

                if (originalIndex >= 0) {
                    const existingChange = changes.find(c => c.hotelIndex === originalIndex);
                    if (!existingChange) {
                        changes.push({
                            hotelIndex: originalIndex,
                            hotelName: targetHotel.name,
                            referenceType: 'price_order',
                            newPrice
                        });
                        console.log(`💰 [HOTEL PRICE ORDER] ${order}: ${targetHotel.name} → $${newPrice}`);
                    }
                }
            }
        }
    }

    // Pattern 3: By chain name
    const chainPattern = /(?:(?:el|hotel)\s+)?(riu|iberostar|bahia|barcelo|meli[aá]|nh|hilton|marriott)\s+(?:a|en|por)?\s*\$?(\d[\d.,]*)/gi;
    let chainMatch;

    while ((chainMatch = chainPattern.exec(message)) !== null) {
        const chainName = chainMatch[1].toLowerCase();
        const newPrice = parsePrice(chainMatch[2]);

        if (newPrice >= 100 && newPrice <= 50000) {
            const hotelIndex = hotels.findIndex(h => h.name.toLowerCase().includes(chainName));

            if (hotelIndex >= 0) {
                const existingChange = changes.find(c => c.hotelIndex === hotelIndex);
                if (!existingChange) {
                    changes.push({
                        hotelIndex,
                        hotelName: hotels[hotelIndex].name,
                        referenceType: 'name',
                        newPrice
                    });
                    console.log(`💰 [HOTEL CHAIN] ${chainName}: ${hotels[hotelIndex].name} → $${newPrice}`);
                }
            }
        }
    }

    if (changes.length > 0) {
        console.log(`✅ [MULTIPLE HOTEL PRICES] Total extracted: ${changes.length}`, changes);
    } else {
        console.log('❌ [MULTIPLE HOTEL PRICES] No hotel prices found');
    }

    return changes;
}

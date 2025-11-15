/**
 * Temporary component for testing city mapping
 * Add this to any page to test the city code mapping system
 *
 * Usage:
 * import { CityMappingTest } from '@/components/CityMappingTest';
 * <CityMappingTest />
 */

import { useState } from 'react';
import { getCityCode, searchCities } from '@/services/cityCodeMapping';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CityMappingTest() {
  const [cityInput, setCity Input] = useState('');
  const [countryInput, setCountryInput] = useState('');
  const [result, setResult] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const handleTest = async () => {
    try {
      setResult('Buscando...');
      const code = await getCityCode(
        cityInput,
        countryInput || undefined
      );
      setResult(`✅ ${cityInput} → ${code}`);
    } catch (error) {
      setResult(`❌ Error: ${error.message}`);
    }
  };

  const handleSearch = () => {
    const results = searchCities(cityInput, 10);
    setSearchResults(results);
  };

  return (
    <div className="p-6 bg-gray-50 rounded-lg space-y-4">
      <h3 className="font-bold text-lg">🧪 City Mapping Test</h3>

      <div className="space-y-2">
        <Input
          placeholder="Ciudad (ej: Cancún, Punta Cana)"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
        />
        <Input
          placeholder="País (opcional, ej: España)"
          value={countryInput}
          onChange={(e) => setCountryInput(e.target.value)}
        />

        <div className="flex gap-2">
          <Button onClick={handleTest}>
            Get City Code
          </Button>
          <Button onClick={handleSearch} variant="outline">
            Search Cities
          </Button>
        </div>
      </div>

      {result && (
        <div className="p-3 bg-white rounded border">
          <strong>Result:</strong> {result}
        </div>
      )}

      {searchResults.length > 0 && (
        <div className="space-y-2">
          <strong>Search Results ({searchResults.length}):</strong>
          <div className="max-h-60 overflow-y-auto space-y-1">
            {searchResults.map((city, idx) => (
              <div key={idx} className="p-2 bg-white rounded text-sm">
                <strong>{city.cityCode}</strong> - {city.cityName} ({city.countryName})
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-gray-500">
        <p>Ejemplos de prueba:</p>
        <ul className="list-disc ml-4">
          <li>Cancún / cancun / CANCUN (todas deberían dar CUN)</li>
          <li>Punta Cana (debería dar PUJ)</li>
          <li>Córdoba + España (debería desambiguar)</li>
          <li>búsqueda: "bar" (debería mostrar Barcelona, etc)</li>
        </ul>
      </div>
    </div>
  );
}

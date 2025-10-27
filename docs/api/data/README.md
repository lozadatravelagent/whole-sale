# API Static Data

This folder contains static data files used for API integrations and validation.

## Files

### countrylist.xml

**Source**: EUROVIPS API
**Purpose**: List of countries and cities with their codes
**Format**: XML
**Size**: ~1 KB

**Description**:
This file contains country and city codes used by the EUROVIPS/SOFTUR API for hotel and package searches.

**Usage**:
- Validating destination codes before API calls
- Populating autocomplete dropdowns
- Mapping city names to API codes

**Example structure**:
```xml
<?xml version="1.0" encoding="UTF-8"?>
<countries>
  <country code="AR" name="Argentina">
    <city code="BUE" name="Buenos Aires" />
    <city code="COR" name="Córdoba" />
  </country>
  <country code="US" name="United States">
    <city code="NYC" name="New York" />
    <city code="MIA" name="Miami" />
  </country>
</countries>
```

**Note**: This file is currently **not used** in the codebase. It was moved here from the root for organization purposes. Consider implementing city/country code validation using this data.

## Related Files

- **[EUROVIPS API Guide](../Softur%20-%20API%20GUIDE.md)** - Complete API documentation
- **[API Examples](../examples/)** - Real API response examples

## Future Data Files

Potential static data files to add:

- `airline-codes.json` - IATA airline codes mapping
- `airport-codes.json` - Airport codes with city mapping
- `currency-codes.json` - Supported currencies
- `hotel-categories.json` - Hotel category/star mappings

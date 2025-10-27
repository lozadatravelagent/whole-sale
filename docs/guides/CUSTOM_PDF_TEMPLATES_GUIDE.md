# Custom PDF Templates - User Guide

## Overview

The WholeSale Connect AI platform now supports **custom PDF templates** for each agency. This allows agencies to fully customize the design and branding of their travel quote PDFs.

## Features

✅ **Per-Agency Customization**: Each agency can have its own unique PDF templates
✅ **4 Template Types**: Combined, Flights Only, Multiple Flights, Hotels Only
✅ **Automatic Detection**: System automatically uses custom templates when generating PDFs
✅ **Fallback Support**: If no custom template exists, default templates are used
✅ **Base Templates**: Download starter templates to customize
✅ **Validation**: HTML validation before upload to prevent errors

## How It Works

### 1. Database Structure

Each agency has a `custom_template_ids` JSONB field:

```json
{
  "combined": "uuid-of-custom-combined-template",
  "flights": "uuid-of-custom-flights-template",
  "flights2": "uuid-of-custom-flights2-template",
  "hotels": null
}
```

- `null` values mean "use default template"
- UUID values point to custom templates in PDFMonkey

### 2. PDF Generation Flow

```
User generates PDF in chat
       ↓
System gets conversation.agency_id
       ↓
Lookup custom_template_ids for agency
       ↓
   ┌──────────────┐
   │ Has custom?  │
   └──────┬───────┘
          │
    Yes ──┴── No
     ↓         ↓
Use Custom  Use Default
  Template    Template
     ↓         ↓
  Generate PDF
```

### 3. Template Types

| Type | Description | When Used |
|------|-------------|-----------|
| `combined` | Flights + Hotels | When PDF has both flights and hotels |
| `flights` | Single Flight | When PDF has 1 flight only |
| `flights2` | Multiple Flights | When PDF has 2 flights |
| `hotels` | Hotels Only | When PDF has hotels only (uses combined with empty flights) |

## User Guide: Settings Page

### Accessing Template Management

1. Navigate to **Settings** → **PDF Templates** tab
2. Select your agency (for OWNER/SUPERADMIN roles)
3. View all 4 template types

### Template Card Actions

Each template card has these actions:

- **Upload Custom**: Upload your custom HTML template
- **Download**: Download base template to customize
- **Remove** (trash icon): Remove custom template and revert to default

### Uploading a Custom Template

1. Click **Download** (📥) to get the base template
2. Customize the HTML file with your design
3. Click **Upload Custom**
4. Select your customized `.html` file
5. Template is validated and uploaded to PDFMonkey
6. Success! Your custom template is now active

## Developer Guide: Creating Custom Templates

### Available Variables

Templates use **Liquid syntax** for dynamic data:

#### Agency Branding
```liquid
{{ logoUrl }}
{{ primaryColor }}
{{ secondaryColor }}
{{ contact.name }}
{{ contact.email }}
{{ contact.phone }}
```

#### Flight Data
```liquid
{% for flight in selected_flights %}
  {{ flight.airline.name }}
  {{ flight.airline.code }}
  {{ flight.price.amount }}
  {{ flight.price.currency }}
  {{ flight.departure_date }}
  {{ flight.return_date }}
  {{ flight.adults }}
  {{ flight.childrens }}
  {{ flight.luggage }}

  {% for leg in flight.legs %}
    {{ leg.departure.city_code }}
    {{ leg.departure.city_name }}
    {{ leg.departure.time }}
    {{ leg.arrival.city_code }}
    {{ leg.arrival.city_name }}
    {{ leg.arrival.time }}
    {{ leg.duration }}
    {{ leg.flight_type }}
  {% endfor %}
{% endfor %}
```

#### Hotel Data
```liquid
{% for hotel in best_hotels %}
  {{ hotel.name }}
  {{ hotel.location }}
  {{ hotel.stars }}
  {{ hotel.price }}
  {{ hotel.link }}
{% endfor %}
```

#### Combined Data
```liquid
{{ checkin }}
{{ checkout }}
{{ adults }}
{{ childrens }}
{{ total_price }}
{{ total_currency }}
{{ flight_price }}
{{ hotel_price }}
{{ travel_assistance }}
{{ transfers }}
```

### Base Template Structure

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Travel Quote</title>
</head>
<body>
  <div class="header">
    {% if logoUrl %}
    <img src="{{ logoUrl }}" alt="Logo" class="logo" />
    {% endif %}
    <h1>{{ contact.name }}</h1>
    <p>{{ contact.email }} | {{ contact.phone }}</p>
  </div>

  <div class="content">
    <!-- Your custom content here -->
  </div>

  <div class="footer">
    <p>Thank you for your business</p>
  </div>
</body>
</html>
```

### CSS Styling

Templates include default CSS. You can customize:

```css
body {
  font-family: 'Helvetica', 'Arial', sans-serif;
  color: #333;
}

.header {
  text-align: center;
  border-bottom: 2px solid #3b82f6;
}

.price {
  font-size: 18px;
  font-weight: bold;
  color: #059669;
}
```

## Technical Implementation

### Files Modified/Created

**Backend:**
- `supabase/migrations/20251006000001_add_custom_pdf_templates.sql` - Database migration
- `src/services/pdfMonkeyTemplates.ts` - PDFMonkey API integration
- `src/services/pdfMonkey.ts` - Updated with agency template lookup

**Frontend:**
- `src/components/settings/PdfTemplateManager.tsx` - Template management UI
- `src/pages/Settings.tsx` - Added PDF Templates tab
- `src/components/crm/CombinedTravelSelector.tsx` - Pass agency_id
- `src/components/crm/FlightSelector.tsx` - Pass agency_id
- `src/features/crm/services/pdfService.ts` - Updated signatures

### API Functions

```typescript
// Create custom template
createTemplate(input: CreateTemplateInput): Promise<TemplateResponse>

// Get template by ID
getTemplate(templateId: string): Promise<TemplateResponse>

// Update template
updateTemplate(templateId: string, updates: Partial<CreateTemplateInput>): Promise<TemplateResponse>

// Delete template
deleteTemplate(templateId: string): Promise<void>

// Validate HTML
validateTemplateHTML(html: string): { valid: boolean; errors: string[]; warnings: string[] }

// Generate base templates
generateBaseTemplate(type: 'combined' | 'flights' | 'hotels'): string
generateBaseCSS(): string
```

### Database Schema

```sql
ALTER TABLE agencies
ADD COLUMN custom_template_ids JSONB DEFAULT '{
  "combined": null,
  "flights": null,
  "flights2": null,
  "hotels": null
}'::jsonb;

-- Index for faster lookups
CREATE INDEX idx_agencies_custom_templates ON agencies USING gin(custom_template_ids);
```

## Testing

### Test Scenario 1: Upload Custom Template

1. Go to Settings → PDF Templates
2. Download base template for "Combined Travel"
3. Edit HTML (change header text)
4. Upload modified template
5. Generate a PDF in chat
6. Verify custom template is used

### Test Scenario 2: Remove Custom Template

1. In Settings, click trash icon on a custom template
2. Confirm removal
3. Generate a PDF
4. Verify default template is used

### Test Scenario 3: Multiple Agencies

1. As OWNER, select Agency A
2. Upload custom template
3. Switch to Agency B
4. Upload different custom template
5. Generate PDFs from conversations in each agency
6. Verify correct templates are used

## Troubleshooting

### Template Not Uploading

**Issue**: Upload fails with validation error
**Solution**: Check HTML syntax, ensure valid structure

### PDF Still Using Default Template

**Issue**: Custom template uploaded but not used
**Solution**:
1. Check database: `SELECT custom_template_ids FROM agencies WHERE id = 'agency-id'`
2. Verify conversation has correct `agency_id`
3. Check console logs for template lookup

### Template Variables Not Showing

**Issue**: Variables like `{{ flight.price }}` show as empty
**Solution**: Verify variable names match exactly (case-sensitive)

## Security

- ✅ Only OWNER, SUPERADMIN, and ADMIN can upload templates
- ✅ HTML validation prevents malicious code
- ✅ Templates stored in PDFMonkey (not local filesystem)
- ✅ Agency isolation: Each agency can only see/edit their templates

## Future Enhancements

Potential improvements:

- [ ] Visual template editor (drag & drop)
- [ ] Template preview with sample data
- [ ] Template versioning / rollback
- [ ] Template marketplace (share templates between agencies)
- [ ] CSS editor with syntax highlighting
- [ ] Template testing with real data before activation

## Support

For issues or questions:
1. Check console logs for detailed error messages
2. Verify agency_id is correctly set in conversations
3. Test with default templates first
4. Contact development team with specific error messages

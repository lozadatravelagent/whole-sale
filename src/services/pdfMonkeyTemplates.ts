/**
 * PDFMonkey Templates Management Service
 * Handles CRUD operations for custom PDF templates via PDFMonkey API
 */

const PDFMONKEY_API_BASE = 'https://api.pdfmonkey.io/api/v1';

// Get API key from environment
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_PDFMONKEY_API_KEY || import.meta.env.PDFMONKEY_API_KEY || 'M-t6H2L_yhtxmDEek_76';

  if (!apiKey || apiKey.trim() === '') {
    throw new Error('PDFMONKEY_API_KEY not configured');
  }

  return apiKey.trim();
};

export interface TemplateSettings {
  page_size?: 'A4' | 'Letter';
  orientation?: 'portrait' | 'landscape';
  margin?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
}

export interface CreateTemplateInput {
  identifier: string; // Human-readable name
  body: string; // HTML + Liquid template
  scss_style?: string; // CSS/SCSS styling
  settings?: TemplateSettings;
  pdf_engine_id?: string; // Optional PDF engine
}

export interface TemplateResponse {
  id: string;
  identifier: string;
  body: string;
  body_draft?: string;
  scss_style?: string;
  scss_style_draft?: string;
  settings?: TemplateSettings;
  created_at: string;
  updated_at: string;
}

export interface ListTemplatesResponse {
  document_template_cards: Array<{
    id: string;
    identifier: string;
    created_at: string;
    updated_at: string;
  }>;
}

/**
 * List all templates in workspace
 */
export async function listTemplates(): Promise<ListTemplatesResponse> {
  try {
    const response = await fetch(`${PDFMONKEY_API_BASE}/document_template_cards`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to list templates: ${response.status} ${errorText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error listing templates:', error);
    throw error;
  }
}

/**
 * Create a new custom template
 */
export async function createTemplate(input: CreateTemplateInput): Promise<TemplateResponse> {
  try {
    console.log('📝 Creating new PDFMonkey template:', input.identifier);

    const response = await fetch(`${PDFMONKEY_API_BASE}/document_templates`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_template: {
          identifier: input.identifier,
          body: input.body,
          scss_style: input.scss_style || '',
          settings: input.settings || {
            page_size: 'A4',
            orientation: 'portrait'
          },
          pdf_engine_id: input.pdf_engine_id
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create template: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Template created successfully:', result.document_template.id);

    return result.document_template;
  } catch (error) {
    console.error('Error creating template:', error);
    throw error;
  }
}

/**
 * Get template details by ID
 */
export async function getTemplate(templateId: string): Promise<TemplateResponse> {
  try {
    const response = await fetch(`${PDFMONKEY_API_BASE}/document_templates/${templateId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get template: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.document_template;
  } catch (error) {
    console.error('Error getting template:', error);
    throw error;
  }
}

/**
 * Update an existing template
 */
export async function updateTemplate(
  templateId: string,
  updates: Partial<CreateTemplateInput>
): Promise<TemplateResponse> {
  try {
    console.log('🔄 Updating template:', templateId);

    const response = await fetch(`${PDFMONKEY_API_BASE}/document_templates/${templateId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        document_template: updates
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to update template: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Template updated successfully');

    return result.document_template;
  } catch (error) {
    console.error('Error updating template:', error);
    throw error;
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  try {
    console.log('🗑️ Deleting template:', templateId);

    const response = await fetch(`${PDFMONKEY_API_BASE}/document_templates/${templateId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to delete template: ${response.status} ${errorText}`);
    }

    console.log('✅ Template deleted successfully');
  } catch (error) {
    console.error('Error deleting template:', error);
    throw error;
  }
}

/**
 * Validate HTML template structure
 * Checks for basic HTML validity and required Liquid variables
 */
export function validateTemplateHTML(html: string): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if HTML is not empty
  if (!html || html.trim().length === 0) {
    errors.push('Template HTML cannot be empty');
    return { valid: false, errors, warnings };
  }

  // Check for basic HTML structure
  if (!html.includes('<html') && !html.includes('<body')) {
    warnings.push('Template should include <html> and <body> tags');
  }

  // Check for balanced tags (basic validation)
  const openTags = html.match(/<[^/][^>]*>/g) || [];
  const closeTags = html.match(/<\/[^>]+>/g) || [];

  if (openTags.length !== closeTags.length) {
    warnings.push('HTML tags may not be properly balanced');
  }

  // Check for Liquid syntax errors (basic)
  const liquidTags = html.match(/\{\{.*?\}\}/g) || [];
  liquidTags.forEach(tag => {
    if (!tag.includes('}}')) {
      errors.push(`Unclosed Liquid tag: ${tag}`);
    }
  });

  // Warn if no Liquid variables are used
  if (liquidTags.length === 0) {
    warnings.push('Template does not use any Liquid variables - PDF will be static');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Generate a basic template structure for a given type
 */
export function generateBaseTemplate(type: 'combined' | 'flights' | 'hotels'): string {
  const baseHTML = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Travel Quote</title>
</head>
<body>
  <div class="header">
    {% if logoUrl %}
    <img src="{{ logoUrl }}" alt="Agency Logo" class="logo" />
    {% endif %}
    <h1>{{ contact.name }}</h1>
    <p>{{ contact.email }} | {{ contact.phone }}</p>
  </div>

  <div class="content">
    ${type === 'combined' || type === 'flights' ? `
    <section class="flights">
      <h2>Vuelos</h2>
      {% for flight in selected_flights %}
      <div class="flight-card">
        <h3>{{ flight.airline.name }}</h3>
        <p>{{ flight.departure_date }} - {{ flight.return_date }}</p>
        <p class="price">{{ flight.price.amount }} {{ flight.price.currency }}</p>
      </div>
      {% endfor %}
    </section>
    ` : ''}

    ${type === 'combined' || type === 'hotels' ? `
    <section class="hotels">
      <h2>Hoteles</h2>
      {% for hotel in best_hotels %}
      <div class="hotel-card">
        <h3>{{ hotel.name }}</h3>
        <p>{{ hotel.location }}</p>
        <p class="stars">{{ hotel.stars }} estrellas</p>
        <p class="price">{{ hotel.price }} USD</p>
      </div>
      {% endfor %}
    </section>
    ` : ''}

    ${type === 'combined' ? `
    <section class="total">
      <h2>Total</h2>
      <p class="grand-total">{{ total_price }} {{ total_currency }}</p>
    </section>
    ` : ''}
  </div>

  <div class="footer">
    <p>Gracias por su preferencia</p>
  </div>
</body>
</html>
  `.trim();

  return baseHTML;
}

/**
 * Generate basic CSS for templates
 */
export function generateBaseCSS(): string {
  return `
body {
  font-family: 'Helvetica', 'Arial', sans-serif;
  margin: 0;
  padding: 20px;
  color: #333;
}

.header {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 2px solid #3b82f6;
}

.logo {
  max-width: 150px;
  margin-bottom: 15px;
}

h1 {
  color: #3b82f6;
  margin: 10px 0;
}

.content {
  margin: 20px 0;
}

section {
  margin-bottom: 30px;
}

h2 {
  color: #1e40af;
  border-bottom: 1px solid #e5e7eb;
  padding-bottom: 10px;
}

.flight-card, .hotel-card {
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 15px;
}

.price {
  font-size: 18px;
  font-weight: bold;
  color: #059669;
}

.grand-total {
  font-size: 24px;
  font-weight: bold;
  color: #3b82f6;
  text-align: right;
}

.footer {
  text-align: center;
  margin-top: 40px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  color: #6b7280;
}
  `.trim();
}

/**
 * Clone an existing template and replace background image URL in CSS
 * @param sourceTemplateId - ID of the template to clone
 * @param newIdentifier - Name for the new template
 * @param newBackgroundUrl - URL of the new background image
 * @returns Promise<TemplateResponse> - The newly created template
 */
export async function cloneTemplateWithNewBackground(
  sourceTemplateId: string,
  newIdentifier: string,
  newBackgroundUrl: string
): Promise<TemplateResponse> {
  try {
    console.log('🔄 Cloning template:', sourceTemplateId);
    console.log('📸 New background URL:', newBackgroundUrl);

    // 1. Get source template
    const sourceTemplate = await getTemplate(sourceTemplateId);

    // 2. Replace background URL in CSS - multiple patterns to catch all cases
    let updatedCSS = sourceTemplate.scss_style || '';

    // Pattern 1: background: url('...') with any properties after
    updatedCSS = updatedCSS.replace(
      /background:\s*url\(['"]([^'"]+)['"]\)([^;]*);/gi,
      `background: url('${newBackgroundUrl}')$2;`
    );

    // Pattern 2: background-image: url('...')
    updatedCSS = updatedCSS.replace(
      /background-image:\s*url\(['"]([^'"]+)['"]\)/gi,
      `background-image: url('${newBackgroundUrl}')`
    );

    console.log('📝 CSS before replacement (first 500 chars):', sourceTemplate.scss_style?.substring(0, 500));
    console.log('📝 CSS after replacement (first 500 chars):', updatedCSS.substring(0, 500));
    console.log('✅ Replaced background URL in CSS');

    // 3. Replace background URL in HTML body - handle <img> tags and inline styles
    let updatedBody = sourceTemplate.body || '';

    // Pattern 1: <img src="https://res.cloudinary.com/...">
    updatedBody = updatedBody.replace(
      /<img\s+([^>]*\s+)?src=['"]https:\/\/res\.cloudinary\.com\/[^'"]+['"]/gi,
      (match) => {
        // Replace the src URL but keep other attributes
        return match.replace(
          /src=['"]https:\/\/res\.cloudinary\.com\/[^'"]+['"]/i,
          `src="${newBackgroundUrl}"`
        );
      }
    );

    // Pattern 2: Any cloudinary URL in src attribute (more generic)
    updatedBody = updatedBody.replace(
      /src=['"]https:\/\/res\.cloudinary\.com\/[^'"]+['"]/gi,
      `src="${newBackgroundUrl}"`
    );

    // Pattern 3: Inline style with background-image in HTML
    updatedBody = updatedBody.replace(
      /background-image:\s*url\(['"]?https:\/\/res\.cloudinary\.com\/[^'")\s]+['"]?\)/gi,
      `background-image: url('${newBackgroundUrl}')`
    );

    console.log('📝 HTML before replacement (first 500 chars):', sourceTemplate.body?.substring(0, 500));
    console.log('📝 HTML after replacement (first 500 chars):', updatedBody.substring(0, 500));
    console.log('✅ Replaced background URL in HTML');

    // 4. Create new template with modified CSS and HTML
    const newTemplate = await createTemplate({
      identifier: newIdentifier,
      body: updatedBody,
      scss_style: updatedCSS,
      settings: sourceTemplate.settings as TemplateSettings
    });

    console.log('✅ Template cloned successfully:', newTemplate.id);

    return newTemplate;
  } catch (error) {
    console.error('❌ Error cloning template:', error);
    throw error;
  }
}

/**
 * Update background URL in an existing template's CSS
 * @param templateId - ID of the template to update
 * @param newBackgroundUrl - URL of the new background image
 * @returns Promise<TemplateResponse> - The updated template
 */
export async function updateTemplateBackground(
  templateId: string,
  newBackgroundUrl: string
): Promise<TemplateResponse> {
  try {
    console.log('🔄 Updating template background:', templateId);

    // 1. Get current template
    const template = await getTemplate(templateId);

    // 2. Replace background URL in CSS
    const updatedCSS = template.scss_style?.replace(
      /background:\s*url\(['"].*?['"]\)/gi,
      `background: url('${newBackgroundUrl}')`
    ) || '';

    // 3. Update template
    const updatedTemplate = await updateTemplate(templateId, {
      scss_style: updatedCSS
    });

    console.log('✅ Template background updated successfully');

    return updatedTemplate;
  } catch (error) {
    console.error('❌ Error updating template background:', error);
    throw error;
  }
}

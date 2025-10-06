import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import {
  FileText,
  Upload,
  Eye,
  Trash2,
  Loader2,
  Check,
  AlertCircle,
  Code,
  Download
} from 'lucide-react';
import {
  createTemplate,
  validateTemplateHTML,
  generateBaseTemplate,
  generateBaseCSS
} from '@/services/pdfMonkeyTemplates';
import { supabase } from '@/integrations/supabase/client';

interface PdfTemplateManagerProps {
  agencyId: string;
  agencyName: string;
}

type TemplateType = 'combined' | 'flights' | 'flights2' | 'hotels';

interface TemplateInfo {
  type: TemplateType;
  title: string;
  description: string;
  badge: string;
}

const TEMPLATE_TYPES: TemplateInfo[] = [
  {
    type: 'combined',
    title: 'Combined Travel',
    description: 'Template for quotes with both flights and hotels',
    badge: 'Flights + Hotels'
  },
  {
    type: 'flights',
    title: 'Flights Only',
    description: 'Template for single flight quotes',
    badge: '1 Flight'
  },
  {
    type: 'flights2',
    title: 'Multiple Flights',
    description: 'Template for quotes with 2 flights',
    badge: '2 Flights'
  },
  {
    type: 'hotels',
    title: 'Hotels Only',
    description: 'Template for hotel-only quotes',
    badge: 'Hotels'
  }
];

const PdfTemplateManager: React.FC<PdfTemplateManagerProps> = ({
  agencyId,
  agencyName
}) => {
  const [customTemplates, setCustomTemplates] = useState<Record<string, string | null>>({});
  const [uploading, setUploading] = useState<TemplateType | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRefs = useRef<Record<TemplateType, HTMLInputElement | null>>({
    combined: null,
    flights: null,
    flights2: null,
    hotels: null
  });
  const { toast } = useToast();

  // Load custom templates from agency
  React.useEffect(() => {
    loadCustomTemplates();
  }, [agencyId]);

  const loadCustomTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('custom_template_ids')
        .eq('id', agencyId)
        .single();

      if (error) throw error;

      if (data?.custom_template_ids) {
        setCustomTemplates(data.custom_template_ids);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    templateType: TemplateType
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.html')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please upload an HTML file (.html)'
      });
      return;
    }

    setUploading(templateType);

    try {
      // Read file content
      const fileContent = await file.text();

      // Validate HTML
      const validation = validateTemplateHTML(fileContent);

      if (!validation.valid) {
        toast({
          variant: 'destructive',
          title: 'Invalid HTML',
          description: validation.errors.join(', ')
        });
        setUploading(null);
        return;
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        console.warn('Template warnings:', validation.warnings);
      }

      // Create template in PDFMonkey
      const templateName = `${agencyName} - ${templateType} - ${Date.now()}`;
      const newTemplate = await createTemplate({
        identifier: templateName,
        body: fileContent,
        scss_style: generateBaseCSS(),
        settings: {
          page_size: 'A4',
          orientation: 'portrait'
        }
      });

      // Update agency's custom_template_ids
      const updatedTemplates = {
        ...customTemplates,
        [templateType]: newTemplate.id
      };

      const { error: updateError } = await supabase
        .from('agencies')
        .update({ custom_template_ids: updatedTemplates })
        .eq('id', agencyId);

      if (updateError) throw updateError;

      setCustomTemplates(updatedTemplates);

      toast({
        title: 'Template uploaded successfully',
        description: `Your custom ${templateType} template is now active`
      });

      // Clear file input
      if (fileInputRefs.current[templateType]) {
        fileInputRefs.current[templateType]!.value = '';
      }
    } catch (error) {
      console.error('Error uploading template:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setUploading(null);
    }
  };

  const handleDownloadBaseTemplate = (templateType: TemplateType) => {
    const html = generateBaseTemplate(templateType);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${templateType}-template-base.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Base template downloaded',
      description: 'Customize this template and upload it back'
    });
  };

  const handleRemoveCustomTemplate = async (templateType: TemplateType) => {
    if (!confirm('Are you sure you want to remove this custom template? The default template will be used instead.')) {
      return;
    }

    try {
      const updatedTemplates = {
        ...customTemplates,
        [templateType]: null
      };

      const { error } = await supabase
        .from('agencies')
        .update({ custom_template_ids: updatedTemplates })
        .eq('id', agencyId);

      if (error) throw error;

      setCustomTemplates(updatedTemplates);

      toast({
        title: 'Custom template removed',
        description: 'Now using default template'
      });
    } catch (error) {
      console.error('Error removing template:', error);
      toast({
        variant: 'destructive',
        title: 'Failed to remove template',
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATE_TYPES.map((template) => {
          const hasCustomTemplate = !!customTemplates[template.type];
          const isUploading = uploading === template.type;

          return (
            <Card key={template.type} className="border-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{template.title}</CardTitle>
                  </div>
                  <Badge variant="secondary">{template.badge}</Badge>
                </div>
                <CardDescription>{template.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Status:</span>
                  {hasCustomTemplate ? (
                    <Badge variant="default" className="gap-1">
                      <Check className="h-3 w-3" />
                      Custom Active
                    </Badge>
                  ) : (
                    <Badge variant="outline">Using Default</Badge>
                  )}
                </div>

                {/* Hidden file input */}
                <input
                  ref={(el) => (fileInputRefs.current[template.type] = el)}
                  type="file"
                  accept=".html"
                  onChange={(e) => handleFileSelect(e, template.type)}
                  className="hidden"
                />

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    disabled={isUploading}
                    onClick={() => fileInputRefs.current[template.type]?.click()}
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Custom
                      </>
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownloadBaseTemplate(template.type)}
                    title="Download base template"
                  >
                    <Download className="h-4 w-4" />
                  </Button>

                  {hasCustomTemplate && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveCustomTemplate(template.type)}
                      title="Remove custom template"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Help Section */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How to create custom templates:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Download a base template using the <Download className="inline h-3 w-3" /> button</li>
            <li>Customize the HTML with your agency branding (logo, colors, layout)</li>
            <li>Use Liquid syntax for dynamic data: <code className="bg-muted px-1 rounded">{'{{ flight.price }}'}</code></li>
            <li>Upload your custom template using the "Upload Custom" button</li>
            <li>Your custom template will be used automatically for all new PDFs</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Template Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Available Template Variables
          </CardTitle>
          <CardDescription>
            Use these Liquid variables in your custom templates
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Agency Branding</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>{'{{ logoUrl }}'}</li>
                <li>{'{{ primaryColor }}'}</li>
                <li>{'{{ secondaryColor }}'}</li>
                <li>{'{{ contact.name }}'}</li>
                <li>{'{{ contact.email }}'}</li>
                <li>{'{{ contact.phone }}'}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Flight Data</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>{'{{ flight.airline.name }}'}</li>
                <li>{'{{ flight.price.amount }}'}</li>
                <li>{'{{ flight.departure_date }}'}</li>
                <li>{'{{ flight.adults }}'}</li>
                <li>{'{{ flight.legs }}'} (array)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Hotel Data</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>{'{{ hotel.name }}'}</li>
                <li>{'{{ hotel.location }}'}</li>
                <li>{'{{ hotel.stars }}'}</li>
                <li>{'{{ hotel.price }}'}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Combined Data</h4>
              <ul className="space-y-1 font-mono text-xs">
                <li>{'{{ total_price }}'}</li>
                <li>{'{{ total_currency }}'}</li>
                <li>{'{{ checkin }}'}</li>
                <li>{'{{ checkout }}'}</li>
                <li>{'{{ adults }}, {{ childrens }}'}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PdfTemplateManager;

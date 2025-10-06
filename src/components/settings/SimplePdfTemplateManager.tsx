import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  Code
} from 'lucide-react';
import BackgroundImageUploader from './BackgroundImageUploader';

interface SimplePdfTemplateManagerProps {
  agencyId: string;
  agencyName: string;
}

const TEMPLATE_TYPES = [
  {
    type: 'combined' as const,
    title: 'Combined Travel',
    description: 'Template for quotes with both flights and hotels',
    badge: 'Flights + Hotels'
  },
  {
    type: 'flights' as const,
    title: 'Flights Only',
    description: 'Template for single flight quotes',
    badge: '1 Flight'
  },
  {
    type: 'flights2' as const,
    title: 'Multiple Flights',
    description: 'Template for quotes with 2 flights',
    badge: '2 Flights'
  },
  {
    type: 'hotels' as const,
    title: 'Hotels Only',
    description: 'Template for hotel-only quotes',
    badge: 'Hotels'
  }
];

const SimplePdfTemplateManager: React.FC<SimplePdfTemplateManagerProps> = ({
  agencyId,
  agencyName
}) => {
  return (
    <div className="space-y-6">
      {/* Template Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {TEMPLATE_TYPES.map((template) => (
          <BackgroundImageUploader
            key={template.type}
            agencyId={agencyId}
            agencyName={agencyName}
            templateType={template.type}
            title={template.title}
            description={template.description}
            badge={template.badge}
          />
        ))}
      </div>

      {/* Help Section */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>How to customize your PDF templates:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Create a custom background image with your agency's header and footer design</li>
            <li>Recommended size: 800x1132px (A4 portrait format)</li>
            <li>Use PNG format with transparency for best results</li>
            <li>Upload the image above - it will automatically create a custom template</li>
            <li>Your PDFs will use the custom background immediately</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Template Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Design Guidelines
          </CardTitle>
          <CardDescription>
            Tips for creating effective PDF backgrounds
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Header Area (Top 180px)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Place your agency logo and branding</li>
                <li>• Use your brand colors</li>
                <li>• Keep text minimal (content is dynamic)</li>
                <li>• Leave space for document title</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Content Area (Middle)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Keep background light or transparent</li>
                <li>• Avoid busy patterns (text goes here)</li>
                <li>• Subtle watermarks are OK</li>
                <li>• Maintain good contrast</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Footer Area (Bottom 80px)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Add contact information</li>
                <li>• Social media icons</li>
                <li>• Website URL</li>
                <li>• Legal disclaimers</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Best Practices</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Use high-resolution images</li>
                <li>• Test with sample PDFs first</li>
                <li>• Optimize file size (under 1MB)</li>
                <li>• Consider mobile viewing</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimplePdfTemplateManager;

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
    title: 'Viaje Combinado',
    description: 'Plantilla para cotizaciones con vuelos y hoteles',
    badge: 'Vuelos + Hoteles'
  },
  {
    type: 'flights' as const,
    title: 'Solo Vuelos',
    description: 'Plantilla para cotizaciones de un solo vuelo',
    badge: '1 Vuelo'
  },
  {
    type: 'flights2' as const,
    title: 'Vuelos Múltiples',
    description: 'Plantilla para cotizaciones con 2 vuelos',
    badge: '2 Vuelos'
  },
  {
    type: 'hotels' as const,
    title: 'Solo Hoteles',
    description: 'Plantilla para cotizaciones solo de hotel',
    badge: 'Hoteles'
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
          <strong>Cómo personalizar tus plantillas PDF:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
            <li>Crea una imagen de fondo personalizada con el encabezado y pie de página de tu agencia</li>
            <li>Tamaño recomendado: 800x1132px (formato A4 vertical)</li>
            <li>Usa formato PNG con transparencia para mejores resultados</li>
            <li>Sube la imagen arriba - se creará automáticamente una plantilla personalizada</li>
            <li>Tus PDFs usarán el fondo personalizado inmediatamente</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Template Variables Reference */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            Guía de Diseño
          </CardTitle>
          <CardDescription>
            Consejos para crear fondos PDF efectivos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Área de Encabezado (Superior 180px)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Coloca el logo y branding de tu agencia</li>
                <li>• Usa los colores de tu marca</li>
                <li>• Mantén el texto mínimo (el contenido es dinámico)</li>
                <li>• Deja espacio para el título del documento</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Área de Contenido (Centro)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Mantén el fondo claro o transparente</li>
                <li>• Evita patrones complejos (aquí va el texto)</li>
                <li>• Las marcas de agua sutiles están bien</li>
                <li>• Mantén un buen contraste</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Área de Pie de Página (Inferior 80px)</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Añade información de contacto</li>
                <li>• Iconos de redes sociales</li>
                <li>• URL del sitio web</li>
                <li>• Avisos legales</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Mejores Prácticas</h4>
              <ul className="space-y-1 text-xs text-muted-foreground">
                <li>• Usa imágenes de alta resolución</li>
                <li>• Prueba primero con PDFs de muestra</li>
                <li>• Optimiza el tamaño del archivo (menos de 1MB)</li>
                <li>• Considera la visualización móvil</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SimplePdfTemplateManager;

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  Loader2,
  Check,
  Eye,
  Trash2,
  Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cloneTemplateWithNewBackground } from '@/services/pdfMonkeyTemplates';
import { DEFAULT_TEMPLATE_IDS } from '@/services/pdfMonkey';

interface BackgroundImageUploaderProps {
  agencyId: string;
  agencyName: string;
  templateType: 'combined' | 'flights' | 'flights2' | 'hotels';
  title: string;
  description: string;
  badge: string;
}

const BackgroundImageUploader: React.FC<BackgroundImageUploaderProps> = ({
  agencyId,
  agencyName,
  templateType,
  title,
  description,
  badge
}) => {
  const [backgroundUrl, setBackgroundUrl] = useState<string | null>(null);
  const [customTemplateId, setCustomTemplateId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { toast } = useToast();

  // Load current background and template
  React.useEffect(() => {
    loadCurrentBackground();
  }, [agencyId, templateType]);

  const loadCurrentBackground = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agencies')
        .select('pdf_backgrounds, custom_template_ids')
        .eq('id', agencyId)
        .single();

      if (error) throw error;

      const bgUrl = data?.pdf_backgrounds?.[templateType];
      const templateId = data?.custom_template_ids?.[templateType];

      setBackgroundUrl(bgUrl || null);
      setCustomTemplateId(templateId || null);
    } catch (error) {
      console.error('Error loading background:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Tipo de archivo inválido',
        description: 'Por favor sube un archivo de imagen (PNG, JPG, etc.)'
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Archivo muy grande',
        description: 'La imagen debe ser menor a 5MB'
      });
      return;
    }

    setUploading(true);

    try {
      // 1. Upload image to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${agencyId}/${templateType}-background-${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('pdf-backgrounds')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) throw uploadError;

      // 2. Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('pdf-backgrounds')
        .getPublicUrl(uploadData.path);

      console.log('📤 Background image uploaded:', publicUrl);

      // 3. Clone base template with new background URL
      const defaultTemplateId = DEFAULT_TEMPLATE_IDS[templateType];
      const templateName = `${agencyName} - ${templateType} - ${Date.now()}`;

      const newTemplate = await cloneTemplateWithNewBackground(
        defaultTemplateId,
        templateName,
        publicUrl
      );

      console.log('✅ Template cloned with new background:', newTemplate.id);

      // 4. Update agency database
      const { data: agencyData, error: fetchError } = await supabase
        .from('agencies')
        .select('pdf_backgrounds, custom_template_ids')
        .eq('id', agencyId)
        .single();

      if (fetchError) throw fetchError;

      const updatedBackgrounds = {
        ...(agencyData?.pdf_backgrounds || {}),
        [templateType]: publicUrl
      };

      const updatedTemplates = {
        ...(agencyData?.custom_template_ids || {}),
        [templateType]: newTemplate.id
      };

      const { error: updateError } = await supabase
        .from('agencies')
        .update({
          pdf_backgrounds: updatedBackgrounds,
          custom_template_ids: updatedTemplates
        })
        .eq('id', agencyId);

      if (updateError) throw updateError;

      setBackgroundUrl(publicUrl);
      setCustomTemplateId(newTemplate.id);

      toast({
        title: 'Fondo subido exitosamente',
        description: `Tu fondo PDF personalizado para ${templateType} está activo`
      });

      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error uploading background:', error);
      toast({
        variant: 'destructive',
        title: 'Fallo al subir',
        description: error instanceof Error ? error.message : 'Ocurrió un error desconocido'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveBackground = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar este fondo personalizado? Se usará la plantilla predeterminada en su lugar.')) {
      return;
    }

    try {
      const { data: agencyData, error: fetchError } = await supabase
        .from('agencies')
        .select('pdf_backgrounds, custom_template_ids')
        .eq('id', agencyId)
        .single();

      if (fetchError) throw fetchError;

      const updatedBackgrounds = {
        ...(agencyData?.pdf_backgrounds || {}),
        [templateType]: null
      };

      const updatedTemplates = {
        ...(agencyData?.custom_template_ids || {}),
        [templateType]: null
      };

      const { error } = await supabase
        .from('agencies')
        .update({
          pdf_backgrounds: updatedBackgrounds,
          custom_template_ids: updatedTemplates
        })
        .eq('id', agencyId);

      if (error) throw error;

      setBackgroundUrl(null);
      setCustomTemplateId(null);

      toast({
        title: 'Fondo eliminado',
        description: 'Ahora usando la plantilla PDF predeterminada'
      });
    } catch (error) {
      console.error('Error removing background:', error);
      toast({
        variant: 'destructive',
        title: 'Error al eliminar el fondo',
        description: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  };

  if (loading) {
    return (
      <Card className="border-2">
        <CardContent className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="secondary">{badge}</Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Preview */}
        {backgroundUrl && (
          <div className="border rounded-lg overflow-hidden bg-muted">
            <img
              src={backgroundUrl}
              alt="Vista previa del fondo PDF"
              className="w-full h-48 object-cover"
            />
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Estado:</span>
          {customTemplateId ? (
            <Badge variant="default" className="gap-1">
              <Check className="h-3 w-3" />
              Fondo Personalizado Activo
            </Badge>
          ) : (
            <Badge variant="outline">Usando Predeterminado</Badge>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Subiendo...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                {backgroundUrl ? 'Cambiar Fondo' : 'Subir Fondo'}
              </>
            )}
          </Button>

          {backgroundUrl && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(backgroundUrl, '_blank')}
                title="Ver tamaño completo"
              >
                <Eye className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveBackground}
                title="Eliminar fondo personalizado"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </>
          )}
        </div>

        {/* Recommended size */}
        <p className="text-xs text-muted-foreground">
          Recomendado: 800x1132px (A4 vertical), PNG con transparencia preferido
        </p>
      </CardContent>
    </Card>
  );
};

export default BackgroundImageUploader;

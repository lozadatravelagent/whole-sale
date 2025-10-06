import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface TransferOwnerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId: string;
  leadName: string;
  currentOwnerEmail: string;
  onTransferComplete: () => void;
}

export function TransferOwnerDialog({
  open,
  onOpenChange,
  leadId,
  leadName,
  currentOwnerEmail,
  onTransferComplete
}: TransferOwnerDialogProps) {
  const [email, setEmail] = useState('');
  const [validating, setValidating] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [userFound, setUserFound] = useState<{ id: string; name: string; email: string } | null>(null);
  const [error, setError] = useState('');
  const { toast } = useToast();

  const validateEmail = async () => {
    if (!email || !email.includes('@')) {
      setError('Ingresa un email válido');
      return;
    }

    if (email === currentOwnerEmail) {
      setError('Este usuario ya es el owner actual');
      return;
    }

    setValidating(true);
    setError('');
    setUserFound(null);

    try {
      // Search for user by email
      const { data, error: searchError } = await supabase
        .from('users')
        .select('id, name, email')
        .eq('email', email)
        .single();

      if (searchError || !data) {
        setError('Usuario no encontrado. ¿Deseas invitar a este usuario?');
        return;
      }

      setUserFound(data);
    } catch (err) {
      setError('Error al buscar usuario');
    } finally {
      setValidating(false);
    }
  };

  const handleTransfer = async () => {
    if (!userFound) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Primero debes validar el email del nuevo owner'
      });
      return;
    }

    setTransferring(true);

    try {
      // Update lead owner (assigned_user_id)
      const { error: updateError } = await supabase
        .from('leads')
        .update({
          assigned_user_id: userFound.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      toast({
        title: 'Éxito',
        description: `Lead transferido a ${userFound.name || userFound.email} correctamente`
      });

      onTransferComplete();
      onOpenChange(false);

      // Reset state
      setEmail('');
      setUserFound(null);
      setError('');
    } catch (err: any) {
      console.error('Error transferring lead:', err);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: err.message || 'No se pudo transferir el lead'
      });
    } finally {
      setTransferring(false);
    }
  };

  const handleInvite = () => {
    // TODO: Implement user invitation flow
    toast({
      title: 'Función en desarrollo',
      description: 'La invitación de usuarios está en desarrollo. Por ahora, crea el usuario desde la página de Users.'
    });
  };

  const handleClose = () => {
    setEmail('');
    setUserFound(null);
    setError('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transferir Owner</DialogTitle>
          <DialogDescription>
            Transferir "{leadName}" a otro usuario. Todo el historial, notas y archivos se mantendrán intactos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Current Owner Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Owner actual: <strong>{currentOwnerEmail}</strong>
            </AlertDescription>
          </Alert>

          {/* Email Input */}
          <div className="space-y-2">
            <Label htmlFor="transfer-email">Email del nuevo owner</Label>
            <div className="flex gap-2">
              <Input
                id="transfer-email"
                type="email"
                placeholder="usuario@ejemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                  setUserFound(null);
                }}
                onKeyPress={(e) => e.key === 'Enter' && validateEmail()}
                disabled={validating || transferring}
              />
              <Button
                type="button"
                onClick={validateEmail}
                disabled={validating || transferring || !email}
              >
                {validating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Validar'
                )}
              </Button>
            </div>
          </div>

          {/* User Found Success */}
          {userFound && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Usuario encontrado: <strong>{userFound.name || userFound.email}</strong>
              </AlertDescription>
            </Alert>
          )}

          {/* Error / User Not Found */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {error.includes('no encontrado') && (
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleInvite}
                    className="ml-2 h-auto p-0 text-xs underline"
                  >
                    <UserPlus className="h-3 w-3 mr-1" />
                    Invitar usuario
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={transferring}>
            Cancelar
          </Button>
          <Button
            onClick={handleTransfer}
            disabled={!userFound || transferring}
          >
            {transferring ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Transfiriendo...
              </>
            ) : (
              'Transferir Owner'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Rocket, LogIn } from 'lucide-react';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const handleRedirect = () => {
    window.location.href = 'https://app.vibook.ai/login';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f1019] border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center">
            Llegaste al limite de busquedas gratis
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center pt-2">
            Crea tu cuenta para seguir usando Emilia sin restricciones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-2 text-sm text-gray-300">
            <div className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>Busquedas ilimitadas de vuelos, hoteles y paquetes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>Cotizaciones PDF personalizadas para tus clientes</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>CRM completo con seguimiento de leads</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
              <span>Reportes y metricas de rendimiento</span>
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            Planes desde $79.999/mes
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleRedirect}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-5 py-3 rounded-xl font-medium transition-all"
          >
            <Rocket className="w-4 h-4" />
            Crear cuenta gratis
          </button>
          <button
            onClick={handleRedirect}
            className="w-full flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white px-5 py-3 rounded-xl transition-all"
          >
            <LogIn className="w-4 h-4" />
            Ya tengo cuenta
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

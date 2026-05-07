import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Rocket, LogIn } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { getPublicChatCopy, normalizeSupportedLanguage } from '@/features/chat/i18n/chatResultCopy';

interface PaywallModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PaywallModal({ open, onOpenChange }: PaywallModalProps) {
  const { i18n } = useTranslation();
  const copy = getPublicChatCopy(normalizeSupportedLanguage(i18n.language));
  const handleRedirect = () => {
    window.location.href = 'https://app.vibook.ai/login';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0f1019] border border-white/10 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-white text-center">
            {copy.paywallTitle}
          </DialogTitle>
          <DialogDescription className="text-gray-400 text-center pt-2">
            {copy.paywallDescription}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <div className="space-y-2 text-sm text-gray-300">
            {copy.paywallBenefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-2">
                <span className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-gray-500 text-center pt-2">
            {copy.paywallPrice}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <button
            onClick={handleRedirect}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600 text-white px-5 py-3 rounded-xl font-medium transition-all"
          >
            <Rocket className="w-4 h-4" />
            {copy.createFreeAccount}
          </button>
          <button
            onClick={handleRedirect}
            className="w-full flex items-center justify-center gap-2 border border-white/10 hover:bg-white/5 text-gray-300 hover:text-white px-5 py-3 rounded-xl transition-all"
          >
            <LogIn className="w-4 h-4" />
            {copy.existingAccount}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

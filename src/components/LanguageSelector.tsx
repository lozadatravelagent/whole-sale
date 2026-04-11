import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/hooks/useLanguage';
import { cn } from '@/lib/utils';

interface LanguageSelectorProps {
  className?: string;
  showLabel?: boolean;
  variant?: 'ghost' | 'outline' | 'default';
}

export function LanguageSelector({
  className,
  showLabel = true,
  variant = 'ghost',
}: LanguageSelectorProps) {
  const { language, changeLanguage, supportedLanguages, languageLabels } = useLanguage();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size="sm"
          className={cn('gap-2', className)}
          aria-label="Select language"
          onClick={(e) => e.stopPropagation()}
        >
          <Globe className="h-4 w-4" />
          {showLabel && (
            <span className="hidden sm:inline">{languageLabels[language]}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="z-[100]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {supportedLanguages.map((lang) => (
          <DropdownMenuItem
            key={lang}
            onClick={(e) => {
              e.stopPropagation();
              changeLanguage(lang);
            }}
            className={cn(language === lang && 'bg-accent')}
          >
            {languageLabels[lang]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

import { cn } from '@/lib/utils';
import { SectionEyebrow } from './SectionEyebrow';

interface SectionHeadingProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  as?: 'h1' | 'h2';
  id?: string;
  className?: string;
  headingClassName?: string;
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
  as = 'h2',
  id,
  className,
  headingClassName,
}: SectionHeadingProps) {
  const Heading = as;
  const alignmentClasses =
    align === 'center'
      ? 'text-center items-center mx-auto'
      : 'text-left items-start';

  return (
    <div
      className={cn(
        'flex flex-col gap-4 max-w-3xl',
        alignmentClasses,
        className,
      )}
    >
      {eyebrow ? <SectionEyebrow>{eyebrow}</SectionEyebrow> : null}
      <Heading
        id={id}
        className={cn(
          'font-semibold tracking-tight text-foreground leading-[1.1]',
          as === 'h1'
            ? 'text-4xl sm:text-5xl lg:text-6xl'
            : 'text-3xl sm:text-4xl lg:text-5xl',
          headingClassName,
        )}
      >
        {title}
      </Heading>
      {subtitle ? (
        <p className="text-lg text-muted-foreground leading-relaxed">
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

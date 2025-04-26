import { cn } from '@/lib/utils';
import { TypographyVariant } from '@/types/typography.type';

export function Typography({
  variant,
  className,
  children,
  ...props
}: {
  variant: TypographyVariant;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<
  | HTMLHeadingElement
  | HTMLParagraphElement
  | HTMLQuoteElement
  | HTMLDivElement
  | HTMLTableElement
  | HTMLTableCellElement
  | HTMLElement
>) {
  const variants = {
    h1: 'scroll-m-20 text-4xl font-extrabold tracking-tight lg:text-5xl',
    h2: 'scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0',
    h3: 'scroll-m-20 text-2xl font-semibold tracking-tight',
    h4: 'scroll-m-20 text-xl font-semibold tracking-tight',
    p: 'leading-7 ',
    blockquote: 'mt-6 border-l-2 pl-6 italic',
    table: 'my-6 w-full overflow-y-auto',
    inlineCode: 'relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold',
    lead: 'text-xl',
    large: 'text-lg font-semibold',
    small: 'text-sm font-medium leading-none',
    muted: 'text-sm text-muted-foreground',
  };

  const Element =
    variant === 'h1'
      ? 'h1'
      : variant === 'h2'
        ? 'h2'
        : variant === 'h3'
          ? 'h3'
          : variant === 'h4'
            ? 'h4'
            : variant === 'p'
              ? 'p'
              : variant === 'blockquote'
                ? 'blockquote'
                : variant === 'table'
                  ? 'div'
                  : variant === 'inlineCode'
                    ? 'code'
                    : variant === 'lead'
                      ? 'p'
                      : variant === 'large'
                        ? 'div'
                        : variant === 'small'
                          ? 'small'
                          : variant === 'muted'
                            ? 'p'
                            : 'div'; // Elemento por defecto

  const baseStyles = variants[variant] || '';

  if (variant === 'table') {
    return (
      <div className={cn(baseStyles, className)} {...props}>
        {children}
      </div>
    );
  }

  if (variant === 'inlineCode') {
    return (
      <code className={cn(baseStyles, className)} {...props}>
        {children}
      </code>
    );
  }

  if (variant === 'large') {
    return (
      <div className={cn(baseStyles, className)} {...props}>
        {children}
      </div>
    );
  }

  return (
    <Element className={cn(baseStyles, className)} {...props}>
      {children}
    </Element>
  );
}

import React from 'react';

interface FieldsetProps extends React.HTMLAttributes<HTMLFieldSetElement> {
  legend?: string;
  children: React.ReactNode;
}

export const Fieldset = ({ legend, children, className = '', ...props }: FieldsetProps) => {
  return (
    <fieldset className={`border p-1 sm:p-3 rounded-md ${className}`} {...props}>
      {legend && (
        <legend className="text-sm font-medium px-2 text-muted-foreground">{legend}</legend>
      )}
      {children}
    </fieldset>
  );
};

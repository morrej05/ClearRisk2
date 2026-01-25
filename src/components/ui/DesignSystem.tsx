import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`bg-white border border-neutral-200 rounded-lg p-6 ${className}`}>
      {children}
    </div>
  );
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost';
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-red-600 text-white hover:bg-red-700',
    secondary: 'bg-white text-neutral-700 border border-neutral-300 hover:bg-neutral-50',
    destructive: 'bg-red-600 text-white hover:bg-red-700',
    ghost: 'text-neutral-700 hover:bg-neutral-100'
  };

  return (
    <button
      className={`${baseStyles} ${variants[variant]} ${className}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'neutral' | 'risk-low' | 'risk-medium' | 'risk-high' | 'success' | 'warning' | 'info';
  className?: string;
}

export function Badge({ children, variant = 'neutral', className = '' }: BadgeProps) {
  const variants = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
    'risk-low': 'bg-green-50 text-green-700 border-green-200',
    'risk-medium': 'bg-amber-50 text-amber-700 border-amber-200',
    'risk-high': 'bg-red-50 text-red-700 border-red-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-amber-50 text-amber-700 border-amber-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200'
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-sm font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

interface CalloutProps {
  children: React.ReactNode;
  variant?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  className?: string;
}

export function Callout({ children, variant = 'info', title, className = '' }: CalloutProps) {
  const variants = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    danger: 'bg-red-50 border-red-200 text-red-900',
    success: 'bg-green-50 border-green-200 text-green-900'
  };

  return (
    <div className={`border rounded-lg p-4 ${variants[variant]} ${className}`}>
      {title && <p className="font-semibold mb-2">{title}</p>}
      <div className="text-sm">{children}</div>
    </div>
  );
}

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export function Table({ children, className = '' }: TableProps) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full">
        {children}
      </table>
    </div>
  );
}

export function TableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-neutral-200">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-neutral-100 hover:bg-neutral-50 ${className}`}>
      {children}
    </tr>
  );
}

export function TableHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left py-3 px-4 text-sm font-semibold text-neutral-700 ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={`py-3 px-4 text-sm text-neutral-900 ${className}`}>
      {children}
    </td>
  );
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, actions, className = '' }: PageHeaderProps) {
  return (
    <div className={`mb-8 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 mb-1">{title}</h1>
          {subtitle && <p className="text-neutral-600">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ title, subtitle, actions, className = '' }: SectionHeaderProps) {
  return (
    <div className={`mb-4 ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
          {subtitle && <p className="text-sm text-neutral-600 mt-1">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-12">
      <p className="text-neutral-900 font-medium mb-2">{title}</p>
      {description && <p className="text-neutral-600 text-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

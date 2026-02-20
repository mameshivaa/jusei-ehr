"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "link"
  | "danger"
  | "outline";
type ButtonSize = "list" | "sm" | "md" | "icon" | "lg";

export interface MedicalButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingText?: string;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-slate-700 text-white border border-slate-700
    hover:bg-slate-600 active:bg-slate-800
    focus:ring-slate-200 focus:ring-offset-2
  `,
  secondary: `
    bg-white text-slate-900 border border-slate-300
    hover:bg-slate-50 active:bg-slate-100
    focus:ring-slate-300 focus:ring-offset-2
  `,
  ghost: `
    bg-transparent text-slate-700 border border-transparent
    hover:bg-slate-50
    focus:ring-slate-300 focus:ring-offset-2
  `,
  link: `
    bg-transparent text-slate-900 border border-transparent underline underline-offset-4
    hover:text-slate-700
    focus:ring-slate-400 focus:ring-offset-2
  `,
  danger: `
    bg-white text-slate-900 border border-slate-900
    hover:bg-slate-50 active:bg-slate-100
    focus:ring-slate-400 focus:ring-offset-2
  `,
  outline: `
    bg-white text-slate-900 border border-slate-300
    hover:bg-slate-50 active:bg-slate-100
    focus:ring-slate-300 focus:ring-offset-2
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  list: "h-9 px-2.5 text-[length:var(--list-button-font,0.875rem)]",
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-sm",
  icon: "h-11 w-11 p-0",
  lg: "h-12 px-5 text-sm",
};

export const Button = React.forwardRef<HTMLButtonElement, MedicalButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      loadingText = "処理中...",
      fullWidth = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        type={type}
        disabled={isDisabled}
        className={cn(
          "inline-flex items-center justify-center rounded-md",
          "font-medium tracking-wide",
          "transition-colors duration-150 ease-in-out",
          "focus:outline-none focus:ring-2",
          "disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed",
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && "w-full",
          loading && "relative cursor-wait",
          className,
        )}
        {...props}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg
              className="h-4 w-4 animate-spin text-white"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
              ></path>
            </svg>
            <span className="ml-2 text-xs">{loadingText}</span>
          </div>
        )}
        <div className={cn("flex items-center gap-2", loading && "invisible")}>
          {children}
        </div>
      </button>
    );
  },
);

Button.displayName = "MedicalButton";

export const EmergencyButton = React.forwardRef<
  HTMLButtonElement,
  Omit<MedicalButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="danger" size="lg" {...props} />);

export const SetupButton = React.forwardRef<
  HTMLButtonElement,
  Omit<MedicalButtonProps, "variant">
>((props, ref) => <Button ref={ref} variant="primary" {...props} />);

export const AdminButton = React.forwardRef<
  HTMLButtonElement,
  MedicalButtonProps
>((props, ref) => (
  <Button ref={ref} variant={props.variant || "secondary"} {...props} />
));

EmergencyButton.displayName = "EmergencyButton";
SetupButton.displayName = "SetupButton";
AdminButton.displayName = "AdminButton";

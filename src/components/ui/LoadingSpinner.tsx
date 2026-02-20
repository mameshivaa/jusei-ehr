import React from "react";
import { motion } from "framer-motion";

export interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  color?: "primary" | "secondary" | "white" | "gray";
  variant?: "spinner" | "dots" | "pulse";
  className?: string;
  label?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
  xl: "w-12 h-12",
};

const colorClasses = {
  primary: "text-slate-600",
  secondary: "text-gray-600",
  white: "text-white",
  gray: "text-gray-400",
};

export default function LoadingSpinner({
  size = "md",
  color = "primary",
  variant = "spinner",
  className = "",
  label = "読み込み中...",
}: LoadingSpinnerProps) {
  const baseClasses = `${sizeClasses[size]} ${colorClasses[color]} ${className}`;

  if (variant === "spinner") {
    return (
      <div
        className="flex items-center justify-center"
        role="status"
        aria-label={label}
      >
        <motion.div
          className={`rounded-full border-2 border-current border-t-transparent ${baseClasses}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === "dots") {
    return (
      <div
        className="flex items-center justify-center space-x-1"
        role="status"
        aria-label={label}
      >
        {[0, 1, 2].map((index) => (
          <motion.div
            key={index}
            className={`h-2 w-2 rounded-full bg-current ${colorClasses[color]}`}
            animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: index * 0.2,
              ease: "easeInOut",
            }}
          />
        ))}
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  if (variant === "pulse") {
    return (
      <div
        className="flex items-center justify-center"
        role="status"
        aria-label={label}
      >
        <motion.div
          className={`rounded-full bg-current ${baseClasses}`}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="sr-only">{label}</span>
      </div>
    );
  }

  return null;
}

export function FullPageLoading({
  message = "読み込み中...",
  backdrop = true,
}: {
  message?: string;
  backdrop?: boolean;
}) {
  return (
    <motion.div
      className={`fixed inset-0 z-50 flex items-center justify-center ${backdrop ? "bg-white bg-opacity-75" : ""}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">{message}</p>
      </div>
    </motion.div>
  );
}

export function InlineLoading({
  text = "読み込み中",
  size = "sm",
}: {
  text?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner size={size} variant="dots" />
      <span className="text-sm text-gray-600">{text}</span>
    </div>
  );
}

export function ButtonLoading({
  text = "処理中...",
  variant = "primary",
}: {
  text?: string;
  variant?: "primary" | "secondary";
}) {
  return (
    <div className="flex items-center space-x-2">
      <LoadingSpinner
        size="sm"
        color={variant === "primary" ? "white" : "primary"}
        variant="spinner"
      />
      <span>{text}</span>
    </div>
  );
}

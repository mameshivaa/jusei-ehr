"use client";

import React from "react";

export default function FormField({
  label,
  required,
  description,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  description?: string;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`block ${className || ""}`}>
      <label className="block text-sm text-gray-600">
        {label}
        {required && <span className="text-red-600 ml-1">*</span>}
      </label>
      <div className="mt-1">{children}</div>
      {description && !error && (
        <div className="text-xs text-gray-500 mt-1">{description}</div>
      )}
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

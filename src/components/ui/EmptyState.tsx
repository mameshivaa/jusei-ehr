"use client";

import React from "react";

export default function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="p-8 text-center text-sm text-gray-500">
      <div className="mb-1 font-medium text-gray-800">{title}</div>
      {description && <div className="mb-3">{description}</div>}
      {action}
    </div>
  );
}

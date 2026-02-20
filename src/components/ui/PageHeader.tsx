import React from "react";

type Props = {
  title: string;
  description?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  contentOnly?: boolean;
};

export default function PageHeader({
  title,
  description,
  subtitle,
  actions,
  contentOnly = false,
}: Props) {
  const desc = subtitle ?? description;
  const Inner = (
    <div className="flex items-center justify-between py-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {desc && <p className="mt-1 text-sm text-gray-600">{desc}</p>}
      </div>
      {actions && <div className="flex items-center space-x-3">{actions}</div>}
    </div>
  );

  if (contentOnly) return Inner;

  return (
    <div className="border-b border-gray-200 bg-white shadow-sm">
      <div className="mx-auto max-w-screen-2xl px-4 sm:px-5 lg:px-6">
        {Inner}
      </div>
    </div>
  );
}

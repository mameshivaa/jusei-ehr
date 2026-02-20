import { useId } from "react";

export function useAriaId(prefix?: string): string {
  const id = useId();
  return prefix ? `${prefix}-${id}` : id;
}

export function useFormFieldIds(fieldName: string) {
  const baseId = useAriaId(fieldName);

  return {
    fieldId: baseId,
    errorId: `${baseId}-error`,
    descriptionId: `${baseId}-description`,
    getFieldProps: (hasError = false, hasDescription = false) => {
      const describedBy = [
        hasError ? `${baseId}-error` : null,
        hasDescription ? `${baseId}-description` : null,
      ]
        .filter(Boolean)
        .join(" ");

      return {
        id: baseId,
        "aria-invalid": hasError ? "true" : "false",
        "aria-describedby": describedBy || undefined,
      };
    },
    getErrorProps: () => ({
      id: `${baseId}-error`,
      role: "alert" as const,
      "aria-live": "polite" as const,
    }),
    getDescriptionProps: () => ({
      id: `${baseId}-description`,
    }),
  };
}

"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  error?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
}

export const Select = React.forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "選択してください",
      error = false,
      disabled = false,
      id,
      name,
      className,
    },
    ref,
  ) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [dropdownPosition, setDropdownPosition] = React.useState<{
      top: number;
      left: number;
      width: number;
    } | null>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useImperativeHandle(ref, () => containerRef.current!);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    // ドロップダウンの位置を計算
    React.useEffect(() => {
      if (!isOpen || !buttonRef.current || !mounted) {
        setDropdownPosition(null);
        return;
      }

      const updatePosition = () => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        setDropdownPosition({
          top: rect.bottom + 4,
          left: rect.left,
          width: rect.width,
        });
      };

      updatePosition();
      window.addEventListener("scroll", updatePosition, true);
      window.addEventListener("resize", updatePosition);

      return () => {
        window.removeEventListener("scroll", updatePosition, true);
        window.removeEventListener("resize", updatePosition);
      };
    }, [isOpen, mounted]);

    // クリックアウトサイドで閉じる
    React.useEffect(() => {
      if (!isOpen) return;

      const handleClickOutside = (event: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(event.target as Node) &&
          (!dropdownRef.current ||
            !dropdownRef.current.contains(event.target as Node))
        ) {
          setIsOpen(false);
        }
      };

      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [isOpen]);

    // Escapeキーで閉じる
    React.useEffect(() => {
      if (!isOpen) return;

      const handleEscape = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setIsOpen(false);
          buttonRef.current?.focus();
        }
      };

      document.addEventListener("keydown", handleEscape);
      return () => {
        document.removeEventListener("keydown", handleEscape);
      };
    }, [isOpen]);

    const selectedOption = options.find((opt) => opt.value === value);
    const displayValue = selectedOption ? selectedOption.label : placeholder;
    const isPlaceholder = !selectedOption;

    const handleSelect = (optionValue: string) => {
      if (onChange) {
        onChange(optionValue);
      }
      setIsOpen(false);
      buttonRef.current?.focus();
    };

    return (
      <div ref={containerRef} className={cn("relative", className)}>
        {/* 隠しinput（フォーム送信用） */}
        {name && (
          <input type="hidden" name={name} value={value ?? ""} id={id} />
        )}
        {/* トリガーボタン */}
        <button
          ref={buttonRef}
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen(!isOpen)}
          className={cn(
            "w-full px-3 py-2 pr-9",
            "border rounded-lg",
            "bg-white text-left",
            "text-sm",
            "focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-slate-500",
            "disabled:bg-slate-100 disabled:cursor-not-allowed",
            "transition-colors",
            isPlaceholder && "text-slate-500",
            !isPlaceholder && "text-slate-900",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500"
              : "border-slate-300",
            isOpen && "ring-2 ring-slate-500 border-slate-500",
          )}
          aria-haspopup="listbox"
          aria-expanded={isOpen}
        >
          <span className="block truncate">{displayValue}</span>
          <ChevronDown
            className={cn(
              "absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none transition-transform",
              disabled ? "text-slate-400" : "text-slate-500",
              isOpen && "rotate-180",
            )}
          />
        </button>

        {/* ドロップダウンメニュー */}
        {isOpen &&
          mounted &&
          dropdownPosition &&
          createPortal(
            <div
              ref={dropdownRef}
              className="fixed z-[10000] bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-auto"
              role="listbox"
              style={{
                top: `${dropdownPosition.top}px`,
                left: `${dropdownPosition.left}px`,
                width: `${dropdownPosition.width}px`,
              }}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                const isDisabled = option.disabled || disabled;

                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    disabled={isDisabled}
                    onClick={() => !isDisabled && handleSelect(option.value)}
                    className={cn(
                      "w-full px-3 py-2 text-left text-sm",
                      "transition-colors",
                      "first:rounded-t-lg last:rounded-b-lg",
                      isSelected
                        ? "bg-slate-100 text-slate-900 font-medium"
                        : "text-slate-900",
                      !isDisabled
                        ? "hover:bg-slate-50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed",
                    )}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>,
            document.body,
          )}
      </div>
    );
  },
);

Select.displayName = "Select";

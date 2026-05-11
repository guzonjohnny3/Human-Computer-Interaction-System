"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

type BaseInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "placeholder" | "size">;

interface FloatingFieldProps extends BaseInputProps {
  label: string;
  /** Optional helper line shown under the input when no error is active. */
  hint?: string;
  /** When set, the helper line shows in red. */
  error?: string;
  /** Optional 16-20 px leading icon (passed an SVG component). */
  leadingIcon?: ReactNode;
  /** Right-side adornment (e.g. show/hide toggle). */
  rightAdornment?: ReactNode;
  /** Render a wrapper-level highlighted state. */
  invalid?: boolean;
}

/**
 * Floating-label text input — CSUCC Aura styling.
 *
 * The label sits inside the input by default. When the input is focused, OR
 * has a value (we use the placeholder-shown trick: a single-space placeholder
 * means there's "always a placeholder", so `:placeholder-shown` is only true
 * when the value is empty), the label floats up to the border.
 *
 * Tailwind v4 keeps `peer-focus` and `peer-placeholder-shown` working.
 */
export function FloatingField({
  label,
  hint,
  error,
  leadingIcon,
  rightAdornment,
  invalid,
  className,
  ...inputProps
}: FloatingFieldProps) {
  const autoId = useId();
  const id = inputProps.name ? `f-${inputProps.name}` : autoId;
  const showError = !!error || !!invalid;

  return (
    <div className="grid gap-1.5">
      <div
        className={[
          "group relative rounded-xl border bg-[rgba(20,5,8,0.55)] backdrop-blur-sm transition",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          showError
            ? "border-red-400/60 focus-within:border-red-300 focus-within:ring-2 focus-within:ring-red-400/30"
            : "border-amber-200/15 focus-within:border-amber-300/60 focus-within:ring-2 focus-within:ring-amber-300/25 hover:border-amber-200/25",
        ].join(" ")}
      >
        {leadingIcon && (
          <span
            aria-hidden
            className={[
              "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 transition",
              showError
                ? "text-red-300"
                : "text-amber-200/70 group-focus-within:text-amber-200",
            ].join(" ")}
          >
            {leadingIcon}
          </span>
        )}
        <input
          id={id}
          /* The single-space placeholder is what makes the floating-label
             :placeholder-shown trick work. Do NOT remove it. */
          placeholder=" "
          {...inputProps}
          className={[
            "csucc-float-input peer block w-full bg-transparent text-[13px] text-amber-50 outline-none",
            leadingIcon ? "pl-10" : "pl-4",
            rightAdornment ? "pr-11" : "pr-4",
            "pt-5 pb-2",
            "placeholder:text-transparent",
            className ?? "",
          ].join(" ")}
        />
        <label
          htmlFor={id}
          className={[
            "pointer-events-none absolute z-10 origin-[0] transform select-none transition-all duration-200",
            leadingIcon ? "left-10" : "left-4",
            "top-3.5 text-[12px] text-amber-200/55",
            /* When the input is unfocused AND empty, the placeholder-shown
               is true, so the label sits low. */
            "peer-placeholder-shown:top-3.5 peer-placeholder-shown:text-[12.5px] peer-placeholder-shown:text-amber-200/55",
            /* When focused or filled, float the label up. */
            "peer-focus:-top-2 peer-focus:left-3 peer-focus:px-1.5 peer-focus:text-[10px] peer-focus:font-semibold peer-focus:uppercase peer-focus:tracking-[0.18em]",
            "peer-focus:bg-[#160508] peer-focus:text-amber-200",
            "peer-[:not(:placeholder-shown)]:-top-2 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:text-[10px] peer-[:not(:placeholder-shown)]:font-semibold peer-[:not(:placeholder-shown)]:uppercase peer-[:not(:placeholder-shown)]:tracking-[0.18em] peer-[:not(:placeholder-shown)]:bg-[#160508] peer-[:not(:placeholder-shown)]:text-amber-200/85",
            showError ? "!text-red-300" : "",
          ].join(" ")}
        >
          {label}
        </label>
        {rightAdornment && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">{rightAdornment}</div>
        )}
      </div>
      {error ? (
        <span className="pl-1 text-[10.5px] font-medium text-red-300">{error}</span>
      ) : hint ? (
        <span className="pl-1 text-[10.5px] text-amber-200/45">{hint}</span>
      ) : null}
    </div>
  );
}

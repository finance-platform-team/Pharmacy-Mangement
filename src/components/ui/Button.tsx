import type { ButtonHTMLAttributes, ReactNode } from "react";
import Icon from "./Icon";
import "./Button.css";

type Variant = "primary" | "gold" | "ghost" | "danger" | "success" | "warn";
type Size = "xs" | "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;      // اسم أيقونة bootstrap-icons, مثال: "bi-check-lg"
  loading?: boolean;
  children?: ReactNode;
}

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  loading = false,
  disabled,
  children,
  className = "",
  ...rest
}: ButtonProps) {
  const classes = [
    "btn-u",
    `btn-u-${variant}`,
    size !== "md" ? `btn-u-${size}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? (
        <span className="spinner-border spinner-border-sm" />
      ) : (
        icon && <Icon name={icon} />
      )}
      {children}
    </button>
  );
}

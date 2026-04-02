import { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "youtube" | "twitch" | "reddit" | "rss";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
  success: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  warning: "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400",
  danger: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  youtube: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  twitch: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  reddit: "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
  rss: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
};

export function Badge({ variant = "default", className = "", children, ...props }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {children}
    </span>
  );
}

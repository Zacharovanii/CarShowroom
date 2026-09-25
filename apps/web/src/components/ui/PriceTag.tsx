import clsx from "clsx";
import { formatMoney } from "@/shared/format";
import styles from "./PriceTag.module.css";

export type PriceTagSize = "sm" | "md" | "lg";

export interface PriceTagProps {
  /** Деньги с провода — строка. В число она не превращается нигде (D12). */
  value: string;
  size?: PriceTagSize;
  className?: string;
}

export function PriceTag({ value, size = "md", className }: PriceTagProps) {
  return (
    <span data-size={size} className={clsx(styles.price, className)}>
      {formatMoney(value)}
    </span>
  );
}

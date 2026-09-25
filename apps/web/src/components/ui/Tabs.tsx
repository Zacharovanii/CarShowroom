import type { ReactNode } from "react";
import * as RadixTabs from "@radix-ui/react-tabs";
import clsx from "clsx";
import styles from "./Tabs.module.css";

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

/** Стрелки, Home/End и roving tabindex — Radix Tabs. Стили свои. */
export function Tabs({ value, defaultValue, onValueChange, children, className }: TabsProps) {
  return (
    <RadixTabs.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      className={clsx(styles.root, className)}
    >
      {children}
    </RadixTabs.Root>
  );
}

export interface TabsListProps {
  /** Подпись списка вкладок для скринридера. */
  label: string;
  children: ReactNode;
  className?: string;
}

export function TabsList({ label, children, className }: TabsListProps) {
  return (
    <RadixTabs.List aria-label={label} className={clsx(styles.list, className)}>
      {children}
    </RadixTabs.List>
  );
}

export interface TabsTriggerProps {
  value: string;
  disabled?: boolean;
  /** Число рядом с подписью: «Предстоящие 2». Ноль показывается, это тоже ответ. */
  count?: number;
  children: ReactNode;
  className?: string;
}

export function TabsTrigger({ value, disabled, count, children, className }: TabsTriggerProps) {
  return (
    <RadixTabs.Trigger
      value={value}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={clsx(styles.trigger, className)}
    >
      {children}
      {/* Счётчик читается вместе с подписью — отдельной остановки
          для скринридера у него нет, это часть имени вкладки. */}
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </RadixTabs.Trigger>
  );
}

export interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className }: TabsContentProps) {
  return (
    <RadixTabs.Content value={value} className={clsx(styles.content, className)}>
      {children}
    </RadixTabs.Content>
  );
}

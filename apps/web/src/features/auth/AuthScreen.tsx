import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import styles from "./AuthScreen.module.css";

export interface AuthScreenProps {
  title: string;
  /** Зачем человека сюда отправили: строка над формой (раздел 6 макетов). */
  lead?: ReactNode;
  children: ReactNode;
  /** Ссылка на соседнюю страницу: «Нет аккаунта? Зарегистрироваться». */
  footer: ReactNode;
}

/** Общая рамка входа и регистрации: узкая карточка по центру страницы. */
export function AuthScreen({ title, lead, children, footer }: AuthScreenProps) {
  return (
    <section className={styles.screen}>
      <Card className={styles.card}>
        <h1 className={styles.title}>{title}</h1>
        {lead && <p className={styles.lead}>{lead}</p>}
        {children}
        <p className={styles.footer}>{footer}</p>
      </Card>
    </section>
  );
}

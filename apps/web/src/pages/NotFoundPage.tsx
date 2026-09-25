import { CircleSlash } from "lucide-react";
import { StatePanel } from "@/components/ui";
import { LinkButton } from "@/shared/ui/LinkButton";
import styles from "./NotFoundPage.module.css";

/**
 * Маршрут `*` — раздел 10 docs/wireframes.md. Своей вёрстки почти нет:
 * это то же «пусто», что у каталога и страницы автомобиля, поэтому
 * рисует его `StatePanel` из кита.
 */
export default function NotFoundPage() {
  return (
    <div className={styles.page}>
      <p className={styles.code}>404</p>

      <StatePanel
        icon={<CircleSlash aria-hidden="true" />}
        title="Такой страницы нет"
        description="Возможно, ссылка устарела или в ней опечатка."
        action={
          <div className={styles.actions}>
            <LinkButton to="/catalog" variant="primary">
              В каталог
            </LinkButton>
            <LinkButton to="/" variant="ghost">
              На главную
            </LinkButton>
          </div>
        }
      />
    </div>
  );
}

import { useState } from "react";
import type { TestDrive } from "@carshowroom/contracts";
import { Button, StatePanel, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { LinkButton } from "@/shared/ui/LinkButton";
import {
  CancelTestDriveDialog,
  TestDriveCard,
  TestDriveCardSkeleton,
  useMyTestDrives,
} from "@/features/test-drives";
import styles from "./TestDrivesPage.module.css";

/**
 * «Мои записи» — UC-U4.
 *
 * Обе вкладки приходят одним ответом `GET /api/me/test-drives`: сервер уже
 * разложил записи на предстоящие и историю, а `cancellable` у каждой говорит,
 * показывать ли «Отменить» (TD-7 фронт не повторяет).
 */
export default function TestDrivesPage() {
  const mine = useMyTestDrives(true);

  /** Какую запись отменяем; `null` — диалог подтверждения закрыт. */
  const [cancelling, setCancelling] = useState<TestDrive | null>(null);

  if (mine.isError) {
    return (
      <section className={styles.section}>
        <h2 className="visually-hidden">Мои записи</h2>
        <StatePanel
          variant="error"
          title="Не удалось загрузить записи"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button variant="primary" loading={mine.isFetching} onClick={() => mine.refetch()}>
              Повторить
            </Button>
          }
        />
      </section>
    );
  }

  return (
    <section className={styles.section}>
      <h2 className="visually-hidden">Мои записи</h2>

      <Tabs defaultValue="upcoming">
        <TabsList label="Мои записи">
          {/* Счётчик показывается, только когда список уже приехал:
              «Предстоящие 0» во время загрузки — неправда */}
          <TabsTrigger value="upcoming" count={mine.data?.upcoming.length}>
            Предстоящие
          </TabsTrigger>
          <TabsTrigger value="history" count={mine.data?.history.length}>
            История
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming">
          {mine.isPending ? (
            <TestDriveCardSkeleton />
          ) : mine.data.upcoming.length === 0 ? (
            <StatePanel
              title="Записей пока нет"
              description="Выберите автомобиль и запишитесь на тест-драйв."
              action={<LinkButton to="/catalog">В каталог</LinkButton>}
            />
          ) : (
            <ul className={styles.list}>
              {mine.data.upcoming.map((item) => (
                <li key={item.id}>
                  <TestDriveCard item={item} onCancel={setCancelling} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="history">
          {mine.isPending ? (
            <TestDriveCardSkeleton />
          ) : mine.data.history.length === 0 ? (
            <StatePanel
              title="История пуста"
              description="Сюда попадают прошедшие и отменённые записи."
              action={<LinkButton to="/catalog">В каталог</LinkButton>}
            />
          ) : (
            <ul className={styles.list}>
              {mine.data.history.map((item) => (
                <li key={item.id}>
                  {/* В истории `cancellable` всегда false, поэтому кнопки
                      на карточке не будет — отдельной вёрстки не нужно */}
                  <TestDriveCard item={item} onCancel={setCancelling} />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>

      <CancelTestDriveDialog item={cancelling} onClose={() => setCancelling(null)} />
    </section>
  );
}

import { useCallback, useState } from "react";
import { RotateCcw, Search, UserPlus } from "lucide-react";
import { userRoles, type UserRole } from "@carshowroom/contracts";
import {
  Button,
  Field,
  Input,
  Pagination,
  Select,
  StatePanel,
  type SelectOption,
} from "@/components/ui";
import {
  CreateManagerDialog,
  ROLE_LABELS,
  UsersList,
  UsersListSkeleton,
  useUsers,
  useUsersQuery,
} from "@/features/admin";
import { useDebouncedField, useMediaQuery } from "@/shared/hooks";
import styles from "./UsersPage.module.css";

/** Ниже этой ширины таблица становится карточками (раздел 9 макетов). */
const TABLE_QUERY = "(min-width: 640px)";

/** «Не выбрано» у Radix Select не может быть пустой строкой — нужен свой ключ. */
const ANY = "any";

const ROLE_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Любая" },
  ...userRoles.map((role) => ({ value: role, label: ROLE_LABELS[role] })),
];

/** «1 пользователь», «2 пользователя», «10 пользователей». */
function usersWord(count: number): string {
  const tens = count % 100;
  const ones = count % 10;
  if (ones === 1 && tens !== 11) return "пользователь";
  if (ones >= 2 && ones <= 4 && (tens < 12 || tens > 14)) return "пользователя";
  return "пользователей";
}

/**
 * Пользователи — UC-A1 и UC-A2, раздел 9 docs/wireframes.md.
 *
 * Поиск, фильтр по роли и страница живут в URL (`useUsersQuery`), поэтому
 * страница своего состояния почти не держит: читает запрос, показывает
 * результат и отдаёт изменения обратно в адрес. Маршрут закрыт по роли
 * в AppRoutes, здесь права не проверяются.
 */
export default function UsersPage() {
  const { query, setQuery, resetFilters, hasFilters } = useUsersQuery();
  const users = useUsers(query);
  const hasTable = useMediaQuery(TABLE_QUERY);
  const [createOpen, setCreateOpen] = useState(false);

  // Набранное уезжает в URL с задержкой, иначе API дёргался бы на каждую
  // букву, а история зарастала бы промежуточными адресами.
  const commitSearch = useCallback(
    (next: string) => setQuery({ q: next.trim() || undefined }),
    [setQuery],
  );
  const [draft, setDraft] = useDebouncedField(query.q ?? "", commitSearch);

  const total = users.data?.total;

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <div>
          <h1 className={styles.title}>Пользователи</h1>
          <p className={styles.count}>
            {total === undefined ? "Загружаем список…" : `${total} ${usersWord(total)}`}
          </p>
        </div>

        <Button
          variant="primary"
          iconStart={<UserPlus aria-hidden="true" />}
          onClick={() => setCreateOpen(true)}
        >
          Создать менеджера
        </Button>
      </header>

      <div className={styles.toolbar}>
        <Field label="Поиск">
          {(control) => (
            <div className={styles.search}>
              <Search aria-hidden="true" className={styles.searchIcon} />
              <Input
                {...control}
                type="search"
                placeholder="Имя или email"
                className={styles.searchInput}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
              />
            </div>
          )}
        </Field>

        <Field label="Роль">
          {(control) => (
            <Select
              {...control}
              options={ROLE_OPTIONS}
              value={query.role ?? ANY}
              onValueChange={(value) =>
                setQuery({ role: value === ANY ? undefined : (value as UserRole) })
              }
            />
          )}
        </Field>
      </div>

      {users.isError ? (
        <StatePanel
          variant="error"
          title="Не удалось загрузить пользователей"
          description="Проверьте соединение и попробуйте снова."
          action={
            <Button variant="primary" loading={users.isFetching} onClick={() => users.refetch()}>
              Повторить
            </Button>
          }
        />
      ) : users.isPending ? (
        <UsersListSkeleton compact={!hasTable} />
      ) : users.data.items.length === 0 ? (
        <StatePanel
          title="Никого не нашлось"
          description="Попробуйте изменить поиск или снять фильтр по роли."
          action={
            // Пусто бывает и без отбора: по чужой ссылке со страницей,
            // которой в текущей выборке уже нет. Сброс возвращает и её.
            hasFilters || query.page > 1 ? (
              <Button
                variant="primary"
                iconStart={<RotateCcw aria-hidden="true" />}
                onClick={resetFilters}
              >
                Сбросить поиск
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <UsersList users={users.data.items} compact={!hasTable} />

          <Pagination
            page={users.data.page}
            totalPages={users.data.totalPages}
            onPageChange={(page) => setQuery({ page })}
            label="Страницы списка пользователей"
            className={styles.pagination}
          />
        </>
      )}

      <CreateManagerDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

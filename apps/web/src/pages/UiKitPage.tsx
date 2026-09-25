import { useState } from "react";
import { ArrowRight, Calendar, Cuboid, Search, Zap } from "lucide-react";
import type { TestDriveStatus } from "@carshowroom/contracts";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Dialog,
  DialogClose,
  DialogContent,
  DialogTrigger,
  Field,
  IconButton,
  Input,
  Pagination,
  PriceTag,
  Select,
  Skeleton,
  Spinner,
  StatePanel,
  StatusBadge,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  useToast,
} from "@/components/ui";
import styles from "./UiKitPage.module.css";

/**
 * ВРЕМЕННАЯ СТРАНИЦА ЭТАПА 2, маршрут /__ui. Показывает каждый компонент
 * UI-кита во всех состояниях из §8 docs/design-system.md — чтобы кит можно
 * было проверить глазами и клавиатурой до того, как на нём соберут экраны.
 * Удаляется на этапе 11 вместе с маршрутом.
 */

const STATUSES: TestDriveStatus[] = ["scheduled", "completed", "no_show", "cancelled"];

/** Длинный текст: показывает, что прокручивается тело, а не окно целиком. */
const LONG_TEXT = Array.from({ length: 12 }, (_, index) => (
  <p key={index}>
    Строка содержимого номер {index + 1}. Заголовок и кнопки остаются на месте, пока эта часть
    прокручивается.
  </p>
));

const SERIES = [
  { value: "3", label: "3 серия" },
  { value: "5", label: "5 серия" },
  { value: "x", label: "X серия" },
  { value: "i", label: "i серия (скоро)", disabled: true },
];

export default function UiKitPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(true);
  const [page, setPage] = useState(3);
  const [comment, setComment] = useState("Хочу посмотреть машину вживую.");

  function runLoading() {
    setLoading(true);
    window.setTimeout(() => setLoading(false), 1600);
  }

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Этап 2</p>
        <h1 className={styles.h1}>UI-кит</h1>
        <p className={styles.lede}>
          Витрина компонентов из <code>components/ui</code>. Пройдите страницу Tab-ом: кольцо фокуса
          рисуется снаружи контрола, в том числе на светлой первичной кнопке.
        </p>
      </header>

      {/* ---------------------------------------------------- Button */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Button</h2>

        <h3 className={styles.h3}>Варианты</h3>
        <div className={styles.row}>
          <Button variant="primary">Записаться на тест-драйв</Button>
          <Button variant="secondary">В каталог</Button>
          <Button variant="ghost">Сбросить</Button>
          <Button variant="danger">Отменить запись</Button>
        </div>

        <h3 className={styles.h3}>Размеры</h3>
        <div className={styles.row}>
          <Button size="sm">Малая 32</Button>
          <Button size="md">Средняя 40</Button>
          <Button size="lg">Крупная 48</Button>
        </div>

        <h3 className={styles.h3}>Состояния</h3>
        <div className={styles.row}>
          <Button variant="primary">Обычная</Button>
          <Button variant="primary" disabled>
            Выключена
          </Button>
          <Button variant="primary" loading={loading} onClick={runLoading}>
            Подтвердить запись
          </Button>
          <Button variant="secondary" disabled>
            Выключена
          </Button>
          <Button variant="primary" iconEnd={<ArrowRight />}>
            С иконкой
          </Button>
        </div>
        <p className={styles.note}>
          Нажмите «Подтвердить запись»: ширина не меняется, содержимое подменяется спиннером, фокус
          остаётся на кнопке, ставится <code>aria-busy</code>.
        </p>

        <h3 className={styles.h3}>IconButton</h3>
        <div className={styles.row}>
          <IconButton label="Предыдущий день" icon={<ArrowRight />} size="sm" />
          <IconButton label="Выбрать дату" icon={<Calendar />} />
          <IconButton label="Найти" icon={<Search />} size="lg" />
          <IconButton label="Выключена" icon={<Calendar />} disabled />
          <IconButton label="Загрузка" icon={<Calendar />} loading />
          <IconButton label="Удалить" icon={<Calendar />} variant="danger" />
        </div>
      </section>

      {/* ------------------------------------------- Field / Input */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Field, Input, Checkbox, Select</h2>

        <div className={styles.formGrid}>
          <Field label="Телефон для связи" hint="Подставлен из профиля, можно исправить">
            {(control) => <Input {...control} type="tel" defaultValue="+79991234567" />}
          </Field>

          <Field label="Email" error="Такой email уже зарегистрирован" required>
            {(control) => <Input {...control} type="email" defaultValue="anna@example.com" />}
          </Field>

          <Field label="Email" hint="Email изменить нельзя">
            {(control) => (
              <Input {...control} type="email" defaultValue="anna@example.com" readOnly />
            )}
          </Field>

          <Field label="Email" hint="Поле выключено целиком">
            {(control) => (
              <Input {...control} type="email" defaultValue="anna@example.com" disabled />
            )}
          </Field>

          <Field label="Серия" hint="Фильтр каталога">
            {(control) => <Select {...control} options={SERIES} placeholder="Любая" />}
          </Field>

          <Field label="Серия" error="Выберите серию">
            {(control) => <Select {...control} options={SERIES} placeholder="Любая" />}
          </Field>

          <Field label="Серия" hint="Справочник ещё не загружен">
            {(control) => <Select {...control} options={SERIES} disabled placeholder="Любая" />}
          </Field>
        </div>

        <p className={styles.note}>
          Только для чтения и выключено — разные вещи: <code>readOnly</code> оставляет поле в
          табуляции, текст из него копируется и читается скринридером; <code>disabled</code> убирает
          поле и из того, и из другого.
        </p>

        <h3 className={styles.h3}>Textarea</h3>
        <div className={styles.formGrid}>
          <Field label="Комментарий" hint="Не обязательно">
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                maxLength={500}
                showCount
                value={comment}
                onChange={(event) => setComment(event.target.value)}
              />
            )}
          </Field>

          <Field label="Причина отмены" error="Укажите причину — её увидит клиент" required>
            {(control) => <Textarea {...control} rows={3} />}
          </Field>
        </div>

        <h3 className={styles.h3}>Checkbox</h3>
        <div className={styles.column}>
          <Checkbox checked={agreed} onCheckedChange={setAgreed}>
            У меня есть водительское удостоверение категории B и стаж от 2 лет
          </Checkbox>
          <Checkbox>Согласен на обработку персональных данных</Checkbox>
          <Checkbox invalid>Без этой галочки записаться нельзя</Checkbox>
          <Checkbox disabled>Выключенный чекбокс</Checkbox>
          <Checkbox disabled checked>
            Выключенный и отмеченный
          </Checkbox>
        </div>
      </section>

      {/* -------------------------------------------------- Alert */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Alert</h2>
        <div className={styles.column}>
          <Alert variant="error">Неверный email или пароль.</Alert>
          <Alert variant="success">Данные сохранены.</Alert>
          <Alert variant="warning">
            Слот начнётся меньше чем через час — отменить его уже нельзя.
          </Alert>
          <Alert variant="info" title="Писем мы не отправляем">
            Передайте пароль сотруднику сами.
          </Alert>
        </div>
        <p className={styles.note}>
          Плашка сама объявляет себя через <code>role=&quot;alert&quot;</code>: она появляется в
          ответ на действие и озвучивается сразу. Тон продублирован иконкой и кромкой слева — не
          только цветом.
        </p>
      </section>

      {/* ------------------------------------------------- Бейджи */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Badge, StatusBadge, PriceTag</h2>
        <div className={styles.row}>
          <Badge icon={<Cuboid aria-hidden="true" />}>3D</Badge>
          <Badge icon={<Zap aria-hidden="true" />}>Электро</Badge>
          <Badge tone="info" dot>
            Информация
          </Badge>
          <Badge tone="success" dot>
            Успех
          </Badge>
          <Badge tone="warning" dot>
            Предупреждение
          </Badge>
          <Badge tone="danger" dot>
            Ошибка
          </Badge>
        </div>

        <h3 className={styles.h3}>Статусы записи</h3>
        <div className={styles.row}>
          {STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>

        <h3 className={styles.h3}>Цена</h3>
        <div className={styles.row}>
          <PriceTag value="6700000" size="sm" />
          <PriceTag value="8900000.50" />
          <PriceTag value="13400000" size="lg" />
        </div>
        <p className={styles.note}>
          Деньги приходят строкой и строкой остаются — <code>formatMoney</code> не превращает их в
          число (D12).
        </p>
      </section>

      {/* ------------------------------------------- Card и Tabs */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Card и Tabs</h2>
        <div className={styles.cards}>
          <Card>
            <strong>Плоская карточка</strong>
            <p className={styles.note}>Фон и линия, без тени: тень есть только у диалога.</p>
          </Card>
          <Card variant="interactive">
            <strong>Интерактивная карточка</strong>
            <p className={styles.note}>Поверхность светлеет в hover, темнеет в нажатии.</p>
          </Card>
        </div>

        <Tabs defaultValue="upcoming" className={styles.tabs}>
          <TabsList label="Мои записи">
            <TabsTrigger value="upcoming" count={2}>
              Предстоящие
            </TabsTrigger>
            <TabsTrigger value="history" count={5}>
              История
            </TabsTrigger>
            <TabsTrigger value="empty" disabled>
              Выключенная
            </TabsTrigger>
          </TabsList>
          <TabsContent value="upcoming">Две ближайшие записи.</TabsContent>
          <TabsContent value="history">Пять прошедших записей.</TabsContent>
        </Tabs>
      </section>

      {/* ------------------------- Skeleton, Spinner, StatePanel */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Skeleton, Spinner, StatePanel</h2>

        <div className={styles.skeletons} aria-busy="true">
          <Skeleton variant="text" width="55%" />
          <Skeleton variant="title" width="40%" />
          <Skeleton variant="text" width="70%" />
          <Skeleton variant="block" />
          <Skeleton ratio="3 / 2" />
        </div>
        <p className={styles.note}>
          Последняя заглушка задана пропорцией (<code>ratio</code>), а не вариантом: так держат
          форму кадр галереи и миниатюра.
        </p>

        <div className={styles.row}>
          <Spinner size="sm" />
          <Spinner />
        </div>

        <div className={styles.panels}>
          <StatePanel
            title="Ничего не нашлось"
            description="Попробуйте изменить фильтры или сбросить их."
            icon={<Search aria-hidden="true" />}
            action={<Button variant="primary">Сбросить фильтры</Button>}
          />
          <StatePanel
            variant="error"
            title="Не удалось загрузить каталог"
            description="Проверьте соединение и попробуйте снова."
            action={<Button variant="primary">Повторить</Button>}
          />
          <StatePanel variant="loading" title="Загружаем каталог" description="Секунду." />
        </div>
      </section>

      {/* ------------------------------------- Dialog, Toast, Pagination */}
      <section className={styles.section}>
        <h2 className={styles.h2}>Dialog, Toast, Pagination</h2>

        <div className={styles.row}>
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="danger">Отменить запись</Button>
            </DialogTrigger>
            <DialogContent
              title="Отменить запись?"
              description="BMW X5 xDrive40i, 25 сентября, 14:00. Время освободится для других."
              footer={
                <>
                  <DialogClose asChild>
                    <Button variant="ghost">Не отменять</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="danger">Отменить запись</Button>
                  </DialogClose>
                </>
              }
            />
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>Панель справа</Button>
            </DialogTrigger>
            <DialogContent
              title="14:00 · 25 сентября"
              placement="side"
              footer={
                <DialogClose asChild>
                  <Button variant="primary">Закрыть</Button>
                </DialogClose>
              }
            >
              {LONG_TEXT}
            </DialogContent>
          </Dialog>

          <Dialog>
            <DialogTrigger asChild>
              <Button>Лист снизу</Button>
            </DialogTrigger>
            <DialogContent
              title="Фильтры"
              placement="sheet"
              footer={
                <DialogClose asChild>
                  <Button variant="primary">Показать 12</Button>
                </DialogClose>
              }
            >
              {LONG_TEXT}
            </DialogContent>
          </Dialog>

          <Button
            onClick={() =>
              toast({
                description: "Записали на 25 сентября, 14:00.",
                action: { label: "Мои записи", onClick: () => undefined },
              })
            }
          >
            Тост об успехе
          </Button>

          <Button
            onClick={() =>
              toast({
                tone: "error",
                title: "Время заняли",
                description: "Это время уже заняли. Выберите другое.",
              })
            }
          >
            Тост об ошибке
          </Button>
        </div>

        <p className={styles.note}>
          Три размещения: по центру, панель у правого края во всю высоту (на телефоне она сама
          становится листом снизу) и лист снизу. Прокручивается только тело — заголовок и кнопки
          остаются на виду, поэтому в длинных окнах кнопки кладутся в подошву.
        </p>

        <div className={styles.row}>
          <Pagination
            page={page}
            totalPages={12}
            onPageChange={setPage}
            label="Страницы каталога"
          />
        </div>
      </section>
    </div>
  );
}

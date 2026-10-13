# Сверка с чек-листом ТЗ

Проверка этапа 11. Источник требований — [assignment.md](assignment.md).
Дата сверки: 25.09.2026; ссылки на маршруты и `features/auth` обновлены 13.10.2026
(D26 — админка каталога, D27 — письма). Все ссылки — на файлы в `apps/web/src`, если не сказано иное.

Итог: **24 требования закрыты полностью, 1 закрыто частично, 0 не закрыто.**
Частичное — «чистая консоль»: без браузера её видно только по коду и логам.

---

## Таблица

| # | Требование | Где выполнено | Замечание |
| --- | --- | --- | --- |
| 1 | 5–6+ маршрутов: главная, каталог, `:id`, вход, регистрация, кабинет, 404 | `app/AppRoutes.tsx:36–85` | **17 маршрутов:** `/`, `/catalog`, `/catalog/:slug`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account`, `/account/test-drives`, `/manager`, `/admin/users`, `/admin/cars`, `/admin/cars/new`, `/admin/cars/:id`, `/__ui`, `*`. Требование перевыполнено почти втрое. `/__ui` — служебная витрина кита, **перед сдачей удалить** (см. «Осталось сделать»). |
| 2 | `BrowserRouter` / `Routes` / `Route` | `app/App.tsx:1,33` (`BrowserRouter`), `app/AppRoutes.tsx:2,36,37` (`Routes`, `Route`) | Декларативный режим, без `loader`/`action` (D3): данные везде через TanStack Query. |
| 3 | Вложенный маршрут через `<Outlet />` | `app/AppRoutes.tsx:56–59` (`/account` → index + `test-drives`), `pages/account/AccountLayout.tsx:55` (`<Outlet />`) | Плюс ещё два уровня `Outlet`: каркас страницы `components/layout/RootLayout.tsx:18` и все guard-обёртки (`features/auth/ProtectedRoute.tsx:24,45,58`). |
| 4 | `useParams` | `pages/CarPage.tsx:19` | Единственный источник `slug`; дальше он идёт в `features/car/useCar.ts`. |
| 5 | `useNavigate` | `features/auth/LoginForm.tsx:16,57` (после входа), `features/auth/VerifyEmail.tsx:35,70` (после подтверждения email — в кабинет), `components/layout/Header.tsx:17,75` и `pages/account/AccountLayout.tsx:13,22` (после выхода), `features/test-drives/TestDriveSection.tsx:35` (гость → `/login` с возвратом на слот), `pages/admin/CarNewPage.tsx:15,57` и `pages/admin/CarEditPage.tsx:55,145` (после создания и удаления автомобиля) | Семь мест. После регистрации перехода больше нет: форма сменяется экраном «Проверьте почту» (D27). |
| 6 | Protected Route | `features/auth/ProtectedRoute.tsx:14–25` (`ProtectedRoute`), `:31–46` (`RoleRoute`), `:49–59` (`GuestOnlyRoute`); подключение — `app/AppRoutes.tsx:43,55,63,67` | Три вида защиты вместо одного. Важная деталь: `isPending` разведён с «не вошёл» (`features/auth/authContext.ts:16–20`), иначе на F5 защищённый маршрут мигал бы редиректом; и это только **первая** проверка (`AuthProvider.tsx:8–14`) — `isPending` самого Better Auth поднимается при каждом перечитывании сессии, и `GuestOnlyRoute` размонтировал бы гостевые формы. Доступ реально проверяет бэкенд — проверено живым прогоном: клиент на `/api/manager/test-drives` и `/api/admin/users` получает 403. |
| 7 | `NavLink` с активным пунктом | `components/layout/Header.tsx:95` (десктоп), `:168` (мобильное меню), класс — `:78–84`; ещё `pages/account/AccountLayout.tsx:31,38` (разделы кабинета) | Активный пункт — `styles.navLinkActive` / `styles.itemActive`. `end` у «Главной», иначе она активна везде. |
| 8 | 404 | `app/AppRoutes.tsx:83` (`path="*"`), страница — `pages/NotFoundPage.tsx` | **Исправлено на этапе 11.** До этого страница была заглушкой этапа 1 («Страница ещё не собрана — этап 11»). Теперь — по разделу 10 `wireframes.md`: «404», «Такой страницы нет», кнопки «В каталог» и «На главную». |
| 9 | 8–10 функциональных компонентов, `components/` и `pages/` | Структура `apps/web/src`: `components/ui` (20 примитивов), `components/layout` (3), `pages` (18 на 13.10.2026), `features` (8 фич) | **88 функциональных компонентов** против требуемых 8–10. Классовых компонентов один — `features/car-viewer/SceneErrorBoundary.tsx` (границу ошибок React иначе не написать). |
| 10 | 2–3 переиспользуемых компонента | `components/ui/Button.tsx`, `Input.tsx`, `Field.tsx`, `Dialog.tsx`, `StatePanel.tsx`, `Skeleton.tsx`, `Badge.tsx`, `Select.tsx`, `Toast.tsx` и др. — экспорт через `components/ui/index.ts`; `features/catalog/CarCard.tsx` стоит и в каталоге (`pages/CatalogPage.tsx:172`), и на главной (`pages/HomePage.tsx:98`) | `Dialog` переиспользован в трёх ролях (`placement`: center / side / sheet) — диалог записи, панель менеджера, лист фильтров на телефоне. |
| 11 | `useState` в 5+ компонентах | 31 компонент (на 13.10.2026, без витрины `UiKitPage`), среди них: `components/layout/Header.tsx:20,22,28`, `components/ui/Toast.tsx:22`, `components/ui/Textarea.tsx`, `features/auth/LoginForm.tsx`, `RegisterForm.tsx:53–64`, `ProfileForm.tsx`, `PasswordForm.tsx`, `ResendVerification.tsx`, `VerifyEmail.tsx`, `ForgotPasswordForm.tsx`, `ResetPasswordForm.tsx`, `features/catalog/…`, `features/car/Gallery.tsx`, `CarMedia.tsx`, `features/car-viewer/CarViewer.tsx:49,50`, `CarScene.tsx:24`, `features/test-drives/BookingDialog.tsx`, `CancelTestDriveDialog.tsx`, `TestDriveSection.tsx`, `features/manager/TestDrivePanel.tsx`, `features/admin/CreateManagerDialog.tsx`, `features/admin-cars/…` (5 файлов), `pages/ManagerPage.tsx`, `pages/account/TestDrivesPage.tsx`, `pages/admin/UsersPage.tsx` | В шесть раз сверх требования. |
| 12 | `useEffect` в 2+ сценариях | `components/layout/Header.tsx:36` (блокировка прокрутки под меню), `:46` (Esc и клик мимо выпадающего меню), `features/car-viewer/CarModel.tsx:56` (освобождение материалов three.js), `:62` (сигнал «модель готова»), `:66` (**выбор цвета → материал 3D-модели** — сценарий прямо из ТЗ), `features/test-drives/DayStrip.tsx:24` (прокрутка ленты к выбранному дню), `shared/hooks/useDebouncedField.ts:24` (задержка перед уходом в URL) | Семь эффектов в шести файлах. Второй сценарий из ТЗ — «синхронизация фильтров с URL» — сделан **без** `useEffect`: URL и есть состояние (`features/catalog/useCatalogQuery.ts:70–94`, `useSearchParams`). Это сильнее, чем эффект-синхронизация, и стоит так и сказать на защите. |
| 13 | Пропсы в 3+ местах, колбэки в 2+ | Пропсы: `features/catalog/CarCard.tsx:7–11`, `features/car-viewer/ColorPicker.tsx`, `features/test-drives/SlotGrid.tsx`, `features/admin/UsersList.tsx:7–11`, `components/ui/StatePanel.tsx:8–18` и ещё десятки. Колбэки: `CarViewer.tsx:19` (`onShowPhotos`), `ColorPicker` (`onSelect`, вызов — `CarViewer.tsx:86`), `SlotGrid` (`onSelect`), `FilterPanel.tsx` (`onChange`, `onReset`), `UsersPage`/`CatalogPage` (`onPageChange`), `TestDriveTable.tsx:9` (`onOpen`) | Пропсы типизированы отдельными `interface …Props`, экспортируются. |
| 14 | Context API | `features/auth/authContext.ts:27` (`createContext`), провайдер — `features/auth/AuthProvider.tsx:40`, хук — `authContext.ts:29–35`, подключение — `app/App.tsx:30`; второй контекст — `components/ui/toastContext.ts` + `components/ui/Toast.tsx:33`, хук `useToast` | **Расхождение с assignment.md:** там вторым контекстом названа «тема». Темы как контекста нет — светлая тема заложена только токенами (`styles/tokens.css`, блок `[data-theme="light"]`) и на компонентах не проверена (это зафиксировано в `design-system.md` §10 «Отложено»). Фактический второй контекст — уведомления. На требование это не влияет: Context API используется в двух независимых местах. |
| 15 | Регистрация: имя, email, пароль, подтверждение, клиентская валидация | `features/auth/RegisterForm.tsx:131–219` (поля: имя, email, телефон, пароль, подтверждение, согласие на ПДн), валидация — `:69` через `signUpFormSchema` из `@carshowroom/contracts`, разбор ошибок в «поле → сообщение» — `shared/form/fieldErrors.ts` | `noValidate` на форме (`:131`) — сообщения наши, а не браузерные. `confirmPassword` и `consent` — правила формы, на провод не уходят (`:88–93`). После успеха входа нет — экран «Проверьте почту» (`:21–43`, D27). Проверено живым прогоном: регистрация с телефоном не по формату отбивается на клиенте, а если обойти клиент — API отвечает 400 `VALIDATION_FAILED`. |
| 16 | Вход с ошибкой при неверных данных | `features/auth/LoginForm.tsx:45–53`, текст — `features/auth/authErrors.ts`, показ — `:96` (`<Alert variant="error">`) | Живой прогон: `POST /api/auth/sign-in/email` с неверным паролем → 401 `INVALID_EMAIL_OR_PASSWORD`. |
| 17 | Выход (logout) | `components/layout/Header.tsx:71–76` и `:188` (мобильное меню), `pages/account/AccountLayout.tsx:20–23`; сам вызов — `features/auth/authClient.ts` (`signOut`) | После выхода — переход на `/`. Живой прогон: `POST /api/auth/sign-out` → `{"success":true}`, сессия удалена на сервере. |
| 18 | F5 сохраняет сессию | Cookie-сессия Better Auth; чтение — `features/auth/authClient.ts` (`useSession`) → `AuthProvider.tsx:6`; ключевая деталь — `isPending` в `authContext.ts:16–20`, `AuthProvider.tsx:8–14` и `ProtectedRoute.tsx:18` | Живой прогон: после регистрации `GET /api/auth/get-session` с той же cookie возвращает пользователя и сессию до 01.10.2026. |
| 19 | Шапка зависит от статуса | `components/layout/Header.tsx:64–69` (пункты меню по роли: «Записи» — сотруднику, «Пользователи» — админу), `:102–150` (гость видит «Войти / Регистрация», вошедший — имя и меню аккаунта) | Третье состояние — `isPending` (`:102`): пока сессия проверяется, гостевой вид не мигает. |
| 20 | Список через `.map()` с `key` | `pages/CatalogPage.tsx:171` (`key={car.id}`), `pages/HomePage.tsx:98,108,117`, `features/admin/UsersList.tsx:26,54` (`key={user.id}`), `features/manager/TestDriveTable.tsx:36` (`key={item.id}`), `features/test-drives/SlotGrid.tsx`, `DayStrip.tsx`, `features/car/Gallery.tsx`, `components/layout/Header.tsx:94,167`, `components/ui/Toast.tsx:39` | Проверены все 18 файлов с `.map()`. Ключей нет только там, где `.map()` строит массив данных, а не JSX (`features/catalog/FilterPanel.tsx:30`, `features/manager/ManagerFilters.tsx:15,40`, `pages/admin/UsersPage.tsx:32`) — там ключ и не нужен. Ключ по индексу — только у скелетонов (`CatalogPage.tsx:147`, `UsersList.tsx:86`), где список неизменяемый и элементы не переставляются; это корректный случай. |
| 21 | Фильтр и поиск | Поиск — `features/catalog/CatalogSearch.tsx` (задержка 350 мс, `shared/hooks/useDebouncedField.ts`); фильтры — `features/catalog/FilterPanel.tsx` (серия, кузов, двигатель, привод, цена от–до) + `PriceRange.tsx`; сортировка — `pages/CatalogPage.tsx:76–84`; всё состояние в URL — `features/catalog/useCatalogQuery.ts` | Плюс фильтры менеджера (`features/manager/ManagerFilters.tsx`: автомобиль, статус) и поиск в админке (`pages/admin/UsersPage.tsx:97`). Ссылкой с фильтрами можно поделиться, «назад» возвращает прежний выбор. |
| 22 | Условный рендеринг в 2+ местах | `pages/CatalogPage.tsx:133–183` — четыре ветки: ошибка → скелетоны → «Ничего не нашлось» → сетка; `pages/CarPage.tsx:23–47` (не найден / ошибка сети) и `:59` (скелетон); `components/layout/Header.tsx:102–150` (гость / вошедший / проверка); `features/car-viewer/CarViewer.tsx:57–68` (нет 3D / нет WebGL / сцена упала); `pages/account/TestDrivesPage.tsx`, `pages/ManagerPage.tsx`, `pages/admin/UsersPage.tsx` — те же четыре состояния | Сводка состояний по экранам — `wireframes.md` §11; расхождений с кодом не нашлось. |
| 23 | 2+ анимации | Шесть штук, список и ссылки — раздел «Анимации» ниже | Все длительности — через токены `--duration-*`, поэтому `prefers-reduced-motion: reduce` гасит их целиком (`styles/tokens.css:316–329`). |
| 24 | Адаптив | Три брейкпоинта 640 / 1024 / 1280 (`styles/tokens.css:18–20`), 30 `@media`-блоков в 26 модулях; таблицы → карточки (`features/manager/TestDriveTable.module.css:130–199` средствами CSS, `features/admin/UsersList.tsx:23–39` сменой разметки); фильтры каталога → лист снизу (`pages/CatalogPage.tsx:190–219`, `placement="sheet"`); тач-цели 44px (`--tap-target-min`, `styles/tokens.css:234`) | Одно замечание по тач-целям — см. «Найденные дыры», п. 2. |
| 25 | Единый стиль | `styles/tokens.css` + CSS Modules; живая витрина — `docs/styleguide.html` и маршрут `/__ui`; правила — `docs/design-system.md` | Хардкода цветов, отступов, радиусов и длительностей в модулях нет — проверено грепом: все `transition`/`animation` ссылаются на `--duration-*`/`--ease-*`. |
| 26 | Только `let` / `const` | `eslint.config.mjs:17` (`no-var: error`), `:18` (`prefer-const: error`); грепом `var` в `apps/web/src` не встречается | `npm run lint` зелёный. |
| 27 | Чистая консоль | `eslint.config.mjs:16` (`no-console` с разрешённым `console.error`); единственный вызов — `features/car-viewer/SceneErrorBoundary.tsx:35` | **Частично: проверено по коду и логам, не глазами.** Разбор — раздел «Консоль» ниже. |
| 28 | Комментарии в нетривиальных местах | `features/catalog/useCatalogQuery.ts:26–30` (почему негодные параметры из URL выбрасываются), `components/layout/Header.tsx:25–27` (почему правка состояния в рендере, а не эффект), `features/car-viewer/CarModel.tsx:16–27` (почему модель клонируется), `features/catalog/CarCard.tsx:27–36` (слои карточки), `features/car-viewer/CarScene.tsx:37–44` (почему свет руками, а не HDRI), `app/App.tsx:11–18` (почему такой `staleTime` и `retry`) | Комментарии объясняют **почему**, а не пересказывают код. |

---

## Анимации

ТЗ требует минимум две. В проекте шесть на `@keyframes`/`transition` длительности:

| # | Что | Где | Токен |
| --- | --- | --- | --- |
| 1 | Кнопка в карточке каталога раскрывается в «Смотреть» при наведении и фокусе | `features/catalog/CarCard.module.css:158` (`max-width`), `:173` (`opacity`) | `--duration-2`, `--duration-1` |
| 2 | Появление диалога: затемнение, окно по центру, панель сбоку, лист снизу | `components/ui/Dialog.module.css:6,33,44,55,134`; кадры — `:138–166` | `--duration-3` |
| 3 | Блик по скелетону загрузки | `components/ui/Skeleton.module.css:12`, кадры `:34` | `--duration-shimmer` |
| 4 | Тост приезжает и уезжает | `components/ui/Toast.module.css:27,35,43`, кадры `:95,102` | `--duration-3`, `--duration-2` |
| 5 | Вращение спиннера | `components/ui/Spinner.module.css:13`, кадры `:21` | `--duration-spin` |
| 6 | Полоса загрузки 3D-модели (неопределённый прогресс) | `features/car-viewer/CarViewer.module.css:65,72`, кадры `:75` | `--duration-2`, `--duration-shimmer` |

Плюс десятки переходов состояний (hover, focus, смена вкладки) на `--duration-1`.

**`prefers-reduced-motion`.** `styles/tokens.css:316–329`: `--duration-1..3` гасятся до 1ms,
и сверху общее правило на `animation-duration` / `transition-duration`. Проверено по всем
CSS-модулям: **ни одна длительность не написана числом**, обойти токены негде.
Исключение объявлено явно — `features/car-viewer/CarViewer.module.css:87` снимает
анимацию полосы прогресса внутри собственного `@media`.

**3D-сцена.** Автовращения нет: `OrbitControls` без `autoRotate`
(`features/car-viewer/CarScene.tsx:64–71`), `useFrame` в проекте не используется вовсе.
Значит непрерывной анимации в `requestAnimationFrame`, которую общее CSS-правило
не погасило бы, тоже нет. Сцена движется только пока её крутит человек — это прямой
отклик на ввод, гасить его не нужно и нельзя.

---

## Консоль

Что проверено по коду и признано чистым:

- **`console.*`** — правило `no-console` (разрешён только `console.error`) стоит ошибкой,
  `npm run lint` зелёный. Единственный `console.error` —
  `features/car-viewer/SceneErrorBoundary.tsx:35`: падение 3D-сцены с `componentStack`.
  Осмысленный: без него границa ошибок проглотила бы причину молча.
- **`key` в списках** — проверены все 18 файлов с `.map()`, см. строку 20 таблицы.
- **Управляемое ↔ неуправляемое поле** — проверены все 48 мест с `value={…}`.
  Везде, где значение может прийти пустым, стоит `?? ""`:
  `features/catalog/CatalogSearch.tsx:31`, `features/catalog/PriceRange.tsx:36–37`,
  `pages/admin/UsersPage.tsx`. У `Select` пустое значение заменено явным `ANY`
  (`features/catalog/FilterPanel.tsx:79,90,101`, `features/manager/ManagerFilters.tsx:50,59`).
  `undefined` в `value` не попадает нигде.
- **Вложенные `<a>` и `<button>`** — `features/catalog/CarCard.tsx:38–95`: карточка
  целиком `<Link>`, внутри только `<span>`, «кнопка» — тоже `<span>` (`:89`).
  `features/manager/TestDriveTable.tsx:36,70` — `<button>` внутри `<tr>` с `onClick`,
  это законно; вложенных кнопок нет.
- **`<div>` внутри `<p>`** — проверены все `<p>{children}</p>`
  (`components/ui/Alert.tsx:38`, `StatePanel.tsx:50`, `features/auth/AuthScreen.tsx:20,22`):
  внутрь передаются только строки, фрагменты и `<Link>`.
- **Неизвестные DOM-атрибуты** — на своих элементах используются `data-*`
  (`data-variant`, `data-size`, `data-tone`, `data-selected`, `data-awaiting`),
  они валидны; TypeScript отсеял бы остальное.
- **Обновление состояния после размонтирования** — все подписки сняты в cleanup
  (`Header.tsx:40,58`, `useDebouncedField.ts:27`, `useMediaQuery.ts:15`,
  `CarModel.tsx:57–59`); запросы ведёт TanStack Query, которая отменяет их сама.
- **Лог Vite** за весь прогон этапа 11 чистый: ни одной ошибки трансформации.
  `npm run build` проходит, `tsc --noEmit` проходит.

**Чем проверить нечем.** Браузера в окружении нет, поэтому не проверены глазами:
предупреждения React в рантайме, `act()` (фронтовых тестов в проекте нет — `design-plan.md`
§11 называет их «минимально», и они не написаны), ошибки загрузки GLB и WebGL,
предупреждения Radix об отсутствующих описаниях в диалогах. Всё это — в списке
«проверить человеком» ниже.

---

## Найденные дыры

1. **Страница 404 была заглушкой этапа 1** — `pages/NotFoundPage.tsx` рисовал
   «Страница ещё не собрана — этап 11». **Починено:** страница собрана по разделу 10
   `wireframes.md`, `pages/StubPage.tsx` и его модуль удалены (больше никем не использовались).

2. **Тач-цель чекбокса меньше 44px.** `components/ui/Checkbox.module.css:10–11` —
   квадрат 18×18 (`--checkbox-size`), подпись рядом отдельным `<label>`
   (`components/ui/Checkbox.tsx:60–64`), общего `@media (max-width: 639px)`
   с `--tap-target-min` у него нет — в отличие от `Button`, `IconButton`, `Input`,
   `Select`, `Tabs`, `Pagination`. На телефоне чекбоксы стоят в листе фильтров каталога
   и в форме записи на тест-драйв («права категории B», согласие на ПДн) — то есть
   на главном пути сценария.

   **Починено наполовину:** подпись растянута на всю оставшуюся ширину строки
   (`flex: 1`). Она связана с квадратом через `htmlFor`, то есть её область —
   тоже область нажатия; текст и так переносился по ширине строки, поэтому
   видимых изменений нет, а по горизонтали палец теперь попадает в строку целиком.

   **Вертикаль осталась.** Ожидавшаяся правка (`.row { min-height: 44px }`) меняет
   вертикальный ритм формы, а расширение области псевдоэлементом на ±13px способно
   перехватить клик у соседней строки: между двумя чекбоксами TD-8 расстояние меньше
   26px. Обе правки меняют то, что без браузера проверить нечем, поэтому вслепую
   не делались. **Решение — за человеком**, после визуальной проверки.

   Для справки: 44px — требование AAA (WCAG 2.5.5) и собственное правило нашей
   системы (§4 `design-system.md`). Уровень AA (WCAG 2.5.8) требует 24px **или**
   достаточного зазора вокруг цели — в этом виде требование, скорее всего,
   уже выполняется, но подтвердить это можно только измерением в браузере.

3. **`docs/design-system.md` §5 называл четвёртой анимацией «подсказку скролла в hero»** —
   её в `pages/HomePage.module.css` нет и не было. **Починен документ** (раздел 6 задания).

4. **`docs/design-plan.md` §8 расходился с кодом** в трёх местах: провайдер темы,
   `CarGrid`, `PageContainer`. **Починен документ.**

5. **`assignment.md` называет вторым контекстом тему** — её нет (см. строку 14 таблицы).
   Документ не правил: это выжимка ТЗ, и историю в ней лучше сохранить.
   Расхождение зафиксировано здесь.

Ошибок в `apps/api` и `packages/contracts` при сверке не найдено: живой прогон всего
сценария защиты через curl прошёл без единого неожиданного ответа.

---

## Осталось сделать перед сдачей

1. **Удалить маршрут `/__ui` и `pages/UiKitPage.tsx`** (`app/AppRoutes.tsx:27,74–81`).
   Витрина нужна для визуальной проверки человеком и на этапе 11 намеренно оставлена.
   Правка на две минуты: убрать `lazy`-импорт и блок `<Route path="__ui">`,
   удалить `pages/UiKitPage.tsx` и `pages/UiKitPage.module.css`.
2. **Решить, что делать с вертикальной тач-целью чекбокса** (дыра 2) —
   после визуальной проверки в браузере.

## Проверить человеком (нужны глаза и браузер)

- Консоль браузера на всех девяти экранах в трёх ролях: предупреждений React,
  Radix и three.js быть не должно.
- `prefers-reduced-motion: reduce` включённой системной настройкой: диалог, тост,
  скелетон и кнопка карточки не должны двигаться.
- Отсутствие горизонтальной прокрутки на 320, 360, 414, 640, 768, 1024, 1280, 1440.
  По коду дыр не видно (`repeat(auto-fill, minmax(280px, 1fr))` при поле 16px
  помещается в 320px; `.toolbarRow .sort { min-width: 0 }` снимает единственный
  подозрительный `min-width: 200px`), но глазами это не заменишь.
- 3D: загрузка GLB, вращение, приближение, смена цвета кузова, запасной путь
  при выключенном WebGL.
- Светлая тема (`design-system.md` §10: на компонентах не проверена).
- Клавиатура: табуляция по каталогу, ловушка фокуса в диалогах, Esc.

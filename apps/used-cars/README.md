# Авто с пробегом (Django)

Раздел сайта CarShowroom с объявлениями о продаже автомобилей с пробегом. Сделан как
практическая работа «Разработка сайта на Python (Django) с использованием Bootstrap»
(МДК 01.06): страницы генерирует сервер по шаблонам Django, оформление на Bootstrap,
данные лежат в SQLite, есть админ-панель Django.

Раздел не заменяет бэкенд сайта и не пересекается с ним, а дополняет его отдельным
сервисом: своя база, свои миграции, свои страницы под адресом `/used/`. Каталог новых
автомобилей, тест-драйвы и кабинеты остаются в основной части (NestJS + React).
Почему так — D29 в [docs/decisions.md](../../docs/decisions.md).

## Запуск с нуля

Нужны Python 3.13+ и [uv](https://docs.astral.sh/uv/).

```bash
cd apps/used-cars
uv sync                                     # .venv + зависимости строго по uv.lock
uv run python manage.py migrate             # создать db.sqlite3 и таблицы
uv run python manage.py loaddata used_cars  # тестовые данные: 11 марок, 13 опций, 24 машины
uv run python manage.py download_photos     # фото к ним с Unsplash, ~27 МБ (необязательно)
uv run python manage.py createsuperuser     # вход в админку
uv run python manage.py runserver           # http://127.0.0.1:8000/used/
```

Админка: http://127.0.0.1:8000/used/admin/.

**Вместе с основным сайтом.** Из корня репозитория `npm run dev:used` (Django на :8000)
и `npm run dev:web` (Vite на :5173). Vite проксирует `/used` в Django, так что раздел
открывается по адресу http://127.0.0.1:5173/used/, а в подвале сайта появляется ссылка
«С пробегом». Ссылка есть только в dev: на сервер раздел не выкатывается.

### Окружение: uv вместо venv + pip

ТЗ предлагает `python -m venv`, `pip install` и `requirements.txt` из `pip freeze`.
Здесь то же самое делает uv:

| ТЗ | Здесь | Что даёт |
|---|---|---|
| `python -m venv venv` | `uv sync` создаёт `.venv` сам | то же виртуальное окружение, Django не в глобальном Python |
| `pip install django` | `uv add django` | зависимость записывается в `pyproject.toml` |
| `pip freeze > requirements.txt` | `uv.lock` (обновляется сам) | точные версии всех пакетов с хешами |
| `pip install -r requirements.txt` | `uv sync` | окружение воссоздаётся одной командой |

`pyproject.toml` хранит прямые зависимости (что нужно проекту), а `uv.lock` хранит точные
версии всего дерева (что ставится на самом деле). `pip freeze` смешивает это в одном списке,
и обновлять его приходится вручную. Если нужен именно `requirements.txt`:

```bash
uv export --format requirements-txt > requirements.txt
```

`.gitignore` раздела исключает `.venv/`, `db.sqlite3` и `__pycache__/`.

## Структура

```
config/                 проект (startproject)
  settings.py           ru-ru, Europe/Moscow, приложение used_cars, статика под /used/static/
  urls.py               корневые маршруты: /used/admin/ и /used/ → used_cars.urls
used_cars/              приложение (startapp)
  models.py             Brand, Feature, UsedCar
  migrations/           0001_initial, 0002_usedcar_owners_count, 0003_carphoto
  admin.py              настройка админки
  forms.py              UsedCarForm (ModelForm) и UsedCarEditForm
  views.py              представления страниц
  urls.py               маршруты раздела с именами для {% url %}
  templates/            base.html и страницы в templates/used_cars/
  templatetags/         фильтры rub и km: «3 290 000 ₽», «98 000 км»
  static/used_cars/     site.css (Bootstrap в цветах сайта), заглушка фото
  fixtures/             used_cars.json — тестовые данные
  photo_sources.json    откуда скачивать фото из фикстуры (Unsplash)
  management/commands/  download_photos — скачивает эти фото в media/
media/                 фото объявлений (вне гита)
  tests.py              тесты страниц, форм и админки
```

## Модели

```
Brand 1 ──── * UsedCar * ──── * Feature
       ForeignKey   1   ManyToMany
                    │
                    * ForeignKey
                 CarPhoto
```

- **Brand** (марка): `name` (CharField, unique), `country` (CharField, blank).
- **Feature** (опция комплектации): `name` (CharField, unique).
- **UsedCar** (объявление): `brand` (ForeignKey, `on_delete=PROTECT`: марку с объявлениями
  удалить нельзя), `model` (CharField), `year` (PositiveSmallIntegerField, от 1950 до 2100,
  а форма ещё не пускает год из будущего), `mileage_km` (PositiveIntegerField),
  `owners_count` (PositiveSmallIntegerField, default=1), `price` (DecimalField 12,2: деньги
  не во float), `description` (TextField, blank), `features` (ManyToManyField, blank),
  `is_published` (BooleanField, default=False), `created_at` (DateTimeField, auto_now_add).
- **CarPhoto** (фото объявления): `car` (ForeignKey, `on_delete=CASCADE`: фото удаляются
  вместе с объявлением), `image` (ImageField, файл в `media/cars/`, нужен Pillow),
  `position` (порядок; первое фото — обложка). Добавлена третьей миграцией.

У каждой модели есть `__str__` и `Meta` с `verbose_name` и `ordering`.

## Миграции

```bash
uv run python manage.py makemigrations       # создать миграцию по изменениям моделей
uv run python manage.py migrate              # применить
uv run python manage.py showmigrations used_cars
uv run python manage.py sqlmigrate used_cars 0002
```

- **0001_initial** создаёт три таблицы: `used_cars_brand`, `used_cars_feature`,
  `used_cars_usedcar`, и промежуточную таблицу связи ManyToMany `used_cars_usedcar_features`.
- **0002_usedcar_owners_count** добавлена после первой: в модель `UsedCar` добавили поле
  «Владельцев по ПТС». Внутри одна операция `AddField(model_name='usedcar',
  name='owners_count', field=PositiveSmallIntegerField(default=1, ...))`.

Что показывает `sqlmigrate used_cars 0002`. В SQLite нельзя одной командой добавить
обязательную (NOT NULL) колонку с таким ограничением, поэтому Django пересобирает таблицу:

1. `CREATE TABLE "new__used_cars_usedcar" (...)` создаёт новую таблицу, уже с колонкой
   `owners_count smallint unsigned NOT NULL CHECK ("owners_count" >= 0)`;
2. `INSERT INTO "new__..." (...) SELECT ..., 1 FROM "used_cars_usedcar"` копирует все
   строки, и для существующих машин `owners_count` получает `1`. Это `default` из модели:
   без него `makemigrations` спросил бы, чем заполнить старые строки;
3. `DROP TABLE "used_cars_usedcar"` удаляет старую таблицу;
4. `ALTER TABLE ... RENAME TO "used_cars_usedcar"` переименовывает новую на место старой;
5. `CREATE INDEX ... ("brand_id")` заново создаёт индекс внешнего ключа на марку.

Всё это обёрнуто в `BEGIN; ... COMMIT;`: миграция применяется целиком или не применяется
совсем. `MinValueValidator(1)` в SQL не попадает, его проверяют формы и админка.

Применённые миграции не правятся и не удаляются: любое изменение модели — это новая
миграция. Файлы миграций лежат в репозитории.

## Админ-панель

Все четыре модели зарегистрированы в `admin.py`.

- **UsedCar:** `list_display` (модель, марка, год, пробег, владельцы, цена, публикация,
  дата), `list_filter` (публикация, марка, год), `search_fields` (модель, описание, имя
  марки), `list_editable` (цена и галочка «Опубликовано»: модерация прямо из списка),
  `ordering`, `filter_horizontal` для опций, действия «Опубликовать выбранные» и «Снять
  с публикации».
- **Brand:** `list_display` с числом объявлений (считает БД через `annotate`),
  `list_filter` по стране, `search_fields`, `ordering`.
- **Feature:** поиск по названию.

Фото добавляются прямо в карточке объявления (inline), с превью; `CarPhoto`
зарегистрирован и отдельно.

Тестовые данные (93 записи) лежат в фикстуре, чтобы чистый клон сразу показывал
заполненный сайт. Две машины в ней ждут модерации и на сайте не видны.

## Фото

К машинам из фикстуры подобраны 45 фото с [Unsplash](https://unsplash.com) (бесплатная
лицензия Unsplash), по 1–3 на машину, 2048 px по ширине. Записи о фото есть в фикстуре,
а сами файлы в гит не входят (D25): их скачивает `manage.py download_photos` по списку
`used_cars/photo_sources.json`, уже скачанные пропускаются. Пока файлов нет, на сайте
вместо фото заглушка: `UsedCar.gallery` отбрасывает записи без файла.

В dev фото раздаёт сам Django по `/used/media/` (`MEDIA_URL`, `MEDIA_ROOT = media/`);
загруженные через админку файлы ложатся туда же.

## Страницы

| Адрес | Имя маршрута | Что там |
|---|---|---|
| `/used/` | `home` | главная: цифры по базе (`count`, `aggregate`), марки, свежие поступления |
| `/used/cars/` | `car_list` | список: поиск `?q=`, фильтр `?brand=`, сортировка `?sort=` |
| `/used/cars/<int:pk>/` | `car_detail` | объявление (`get_object_or_404`), характеристики, опции |
| `/used/cars/add/` | `car_add` | форма «Продать автомобиль» (ModelForm, `csrf_token`) |
| `/used/cars/<int:pk>/edit/` | `car_edit` | редактирование, только для сотрудника |
| `/used/about/` | `about` | о разделе и контакты |
| `/used/admin/` | — | админ-панель |

- Все страницы наследуют `base.html` (`{% extends %}`, `{% block %}`): navbar,
  сообщения (alerts) и подвал описаны один раз.
- Ссылки строятся через `{% url 'имя' %}`, редиректы через `redirect('имя')`.
- На сайте видны только опубликованные объявления. Новое объявление из формы
  сохраняется скрытым, после отправки показывается сообщение об успехе. Публикует
  объявление менеджер: в админке или в форме редактирования (там есть галочка
  публикации). Скрытое объявление видит только сотрудник, остальным отдаётся 404.
- Bootstrap подключён с CDN и перекрашен в цвета основного сайта переменными `--bs-*`
  в `site.css`: тёмная тема, синий акцент, без скруглений.

## Проверки

```bash
uv run python manage.py check   # ошибки конфигурации
uv run python manage.py test    # 12 тестов: страницы, поиск, фото, формы, права, админка
```

Тесты работают на временной базе: она создаётся и удаляется сама, фикстура грузится в неё.

### Ограничение поиска

SQLite сравнивает без учёта регистра только латиницу, поэтому `icontains` по кириллице
регистр учитывает: «владелец» найдёт «Один владелец», а «Один» не найдёт «один». Модели
и марки записаны латиницей, и для них поиск работает как ожидается.

# Лицензии ассетов

Учебный некоммерческий проект, не официальный сайт BMW. Права на товарный знак и дизайн
кузовов принадлежат BMW AG; пометка об этом стоит в подвале сайта (D1).

Ассеты делятся на две части (D25):

- **В репозитории** — только CC0-заглушки в `apps/api/public/assets/`.
- **Вне репозитория** — настоящие модели и фото в `apps/api/licensed-assets/`
  (в `.gitignore`). Они используются по лицензиям, **допускающим некоммерческое учебное
  использование**, или с неустановленной лицензией. Ни то ни другое не является
  свободной лицензией, поэтому в публичный гит эти файлы не кладутся.

---

## Заглушки в репозитории — `apps/api/public/assets/`

| Файл | Что это | Автор | Лицензия | Источник |
| --- | --- | --- | --- | --- |
| `placeholder-car.glb` | низкополигональный седан (`NormalCar1`), материал краски переименован в `CarPaint` | Quaternius | CC0 | [Poly Pizza](https://poly.pizza/m/Cz6yDaUcM9) |
| `placeholder-car.webp` | картинка «Фото не установлено», сгенерирована для проекта | — | CC0 | — |
| `hdri/canary_wharf_2k.hdr` | панорама для сцены «Город» в 3D, 2k | Andreas Mischok | CC0 | [Poly Haven](https://polyhaven.com/a/canary_wharf) |
| `hdri/urban_street_01_2k.hdr` | панорама для сцены «Улица» в 3D, 2k | Andreas Mischok | CC0 | [Poly Haven](https://polyhaven.com/a/urban_street_01) |

Nest отдаёт их вместо любого отсутствующего `/assets/models/*` и `/assets/cars/*`.

---

## 3D-модели — `apps/api/licensed-assets/models/`

Все 18 моделей — автор **[Ddiaz Design](https://sketchfab.com/ddiaz-design)** (Sketchfab),
лицензия — **только некоммерческое использование** (Creative Commons с условием NC;
точный вариант — BY-NC или BY-NC-SA — указан на странице каждой модели). Скачаны
владельцем проекта под своим аккаунтом Sketchfab 25.09.2026.

Изменения относительно оригинала: **только имя материала краски** — переименовано в
`CarPaint` (у моделей с обвесом — несколько материалов). Геометрия и текстуры не
тронуты, сжатие не применялось. Если лицензия модели BY-NC-SA, файл с переименованным
материалом — адаптация и распространяется на тех же условиях; на код проекта это не
распространяется.

| Файл | Модель на Sketchfab | Исходный материал краски | Размер |
| --- | --- | --- | --- |
| `m2-zacoe-widebody.glb` | 2024 BMW G87 M2 ZACOE WideBody — SEMA Build | `adroBMW_M2G87TNR1_2023PaintTNR_Material_008` | 16 МБ |
| `m2-vorsteiner.glb` | 2024 Vorsteiner BMW G87 M2 VRS Aero Body Kit | `vorsBMW_M2G87TNR2_2023PaintTNR_Material_004` | 16 МБ |
| `m140i.glb` | 2018 BMW M140i | `iBody1` | 3.6 МБ |
| `750li-xdrive.glb` | 2020 BMW 750Li xDrive | `Kuzov_Main` | 9.5 МБ |
| `z4-sdrive35is.glb` | 2014 BMW Z4 sDrive35is | `z4MI_1008030001_004` | 18 МБ |
| `x5-xdrive40i.glb` | 2024 BMW X5 xDrive40i | `CARPAINT` | 22 МБ |
| `m340i-xdrive.glb` | 2020 BMW M340i xDrive | `Kuzov_Main_color` | 16 МБ |
| `m3-f80.glb` | 2015 BMW M3 (F80) | `m3phong5SG1` | 4.3 МБ |
| `m4-competition.glb` | 2025 BMW M4 Competition | `m4car_body1`, `m4car_bodykit1`, `m4car_hood1` | 11 МБ |
| `m4-md4-duke-dynamics.glb` | 2014 BMW M4 Based MD4 by Duke Dynamics | `bM_CarPaint_Max1` | 7.8 МБ |
| `m4-lb-works.glb` | 2014 LB★WORKS BMW 4 Series Body Kit (F82) | `bM_CarPaint_Max1` | 6.8 МБ |
| `x6-xdrive40i.glb` | 2020 BMW X6 xDrive40i | `CarPaint` | 12 МБ |
| `i8-3d-design.glb` | 2018 3D Design Body Kit for BMW i8 (I12) | `baseM_CarPaint_Max1`, `baseM_CarPaintNormal_Max1` | 11 МБ |
| `m440i-gran-coupe.glb` | 2022 BMW M440i xDrive Gran Coupé | `carpaint` | 21 МБ |
| `m3-e46-widebody.glb` | 2018 DTM FiberWerkz BMW M3 E46 WideBody Kit | `bM_CarPaint_Max1`, `bM_CarPaintNormal_Max1` | 6.3 МБ |
| `z4-m-coupe.glb` | 2006 Custom BMW Z4 M Coupe | `BBMW_Z4MCoupeCrew_2006Paint_Material1` | 7.0 МБ |
| `m4-cabrio.glb` | 2018 BMW M4 Convertible (F83) | `CabrioM_CarPaint_Max1` | 6.0 МБ |
| `i8-lb-works.glb` | 2019 LB★WORKS BMW i8 ver.2 | `bBMW_LBi8RewardRecycled_2017Paint_Material1` | 15 МБ |

**Осталось дописать:** прямую ссылку на страницу каждой модели и точный вариант
лицензии (BY-NC или BY-NC-SA) — атрибуция CC обязательна.

### Оговорки по моделям

- **`i8-lb-works.glb`** — краска кузова задана текстурой-ливреей (оранжевый фон с
  надписями Liberty Walk). Фронт умножает выбранный цвет на текстуру, поэтому на этой
  модели цвет палитры смешивается с оранжевым.
- Модели и фото — «пары не прямые»: фото подобраны к модели по смыслу, поколение или
  обвес на снимках местами отличаются (например, M4 Cabrio: модель F83, на фото G83;
  X5 и X6: модели обычных версий, на фото — M-версии).

---

## Фотографии — `apps/api/licensed-assets/cars/`

85 файлов, `{slug}-{n}.jpg`, `-1` — обложка. Найдены в интернете (в основном
Pinterest), **автор и лицензия не установлены**. Скопированы как есть, байт в байт —
без пересжатия и масштабирования. Это превью Pinterest: ~736 px по ширине, большинство
вертикальные, поэтому на крупных блоках фото мягкие.

Для учебного некоммерческого проекта это обычная практика, но это **не** свободные
изображения: в публичный репозиторий они не кладутся, а при любом коммерческом
использовании их нужно заменить.

---

## Чего пока нет

- **HDRI для сцены** (D11, Poly Haven, CC0) — ещё не добавлен.

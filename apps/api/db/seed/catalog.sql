-- =====================================================================
-- CarShowroom — seed каталога. Выполняется после миграций, на пустых
-- таблицах cars/car_images/colors/car_colors (справочники series/
-- body_types/fuel_types уже заполнены миграцией).
--
-- 10 автомобилей BMW разных серий, кузовов, приводов и цен; у трёх —
-- 3D-модель (D11: 2–3 модели, у остальных только фото). 5 цветов кузова,
-- у каждого автомобиля 2–3 из них. Файлы фото и GLB в репозитории пока
-- не лежат — только записи с путями по формату CHECK.
-- =====================================================================

insert into colors (name, hex) values
    ('Alpine White',    '#ffffff'),
    ('Black Sapphire',  '#0b0b0d'),
    ('Mineral Grey',    '#4a4a4d'),
    ('Phytonic Blue',   '#1b3d6d'),
    ('Sunset Orange',   '#c1541d');

insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                  description, drive_type, power_hp, acceleration_s, top_speed_kmh, price,
                  model_3d_path, paint_material)
values
    ((select id from series where name = 'BMW 1 серии'),
     (select id from body_types where name = 'Хэтчбек'),
     (select id from fuel_types where name = 'Бензин'),
     '118i-hatchback', 'BMW 118i', 2025,
     'Компактный хэтчбек с задним приводом — самый доступный вход в модельный ряд BMW.',
     'rwd', 156, 8.5, 210, 3200000, null, null),

    ((select id from series where name = 'BMW 2 серии'),
     (select id from body_types where name = 'Кабриолет'),
     (select id from fuel_types where name = 'Бензин'),
     '230i-cabrio', 'BMW 230i Cabrio', 2025,
     'Купе-кабриолет с мягкой крышей: тот редкий случай, когда открытый верх не мешает динамике.',
     'rwd', 245, 5.8, 250, 4450000, null, null),

    ((select id from series where name = 'BMW 3 серии'),
     (select id from body_types where name = 'Седан'),
     (select id from fuel_types where name = 'Бензин'),
     '320i-sedan', 'BMW 320i', 2026,
     'Бизнес-седан, с которого начинается почти каждый разговор о BMW.',
     'rwd', 184, 7.1, 231, 4650000, null, null),

    ((select id from series where name = 'BMW 3 серии'),
     (select id from body_types where name = 'Универсал'),
     (select id from fuel_types where name = 'Дизель'),
     '320d-touring', 'BMW 320d Touring xDrive', 2025,
     'Универсал для тех, кому нужен багажник не меньше динамики: дизель и полный привод.',
     'xdrive', 190, 7.6, 227, 5100000, null, null),

    ((select id from series where name = 'BMW 4 серии'),
     (select id from body_types where name = 'Гран купе'),
     (select id from fuel_types where name = 'Бензин'),
     '430i-gran-coupe', 'BMW 430i Gran Coupe', 2026,
     'Четырёхдверное купе: силуэт спорткара и место на заднем ряду для двоих взрослых.',
     'rwd', 245, 5.9, 250, 5700000, null, null),

    ((select id from series where name = 'BMW 5 серии'),
     (select id from body_types where name = 'Седан'),
     (select id from fuel_types where name = 'Подключаемый гибрид'),
     '550e-sedan', 'BMW 550e xDrive', 2026,
     'Подключаемый гибрид флагманского седана: заряд на 100 км без бензина и полный привод сверху.',
     'xdrive', 313, 5.4, 230, 8200000, '/assets/models/550e.glb', 'CarPaint'),

    ((select id from series where name = 'BMW 7 серии'),
     (select id from body_types where name = 'Седан'),
     (select id from fuel_types where name = 'Бензин'),
     '760i-sedan', 'BMW 760i xDrive', 2026,
     'Представительский седан: заднее место важнее переднего, а тишина в салоне — часть роскоши.',
     'xdrive', 544, 4.7, 250, 14900000, null, null),

    ((select id from series where name = 'BMW 8 серии'),
     (select id from body_types where name = 'Купе'),
     (select id from fuel_types where name = 'Бензин'),
     'm850i-coupe', 'BMW M850i xDrive', 2025,
     'Гран-туризмо на двоих (и ещё двоих сзади) с мотором V8 и полным приводом.',
     'xdrive', 530, 3.7, 250, 11800000, '/assets/models/m850i.glb', 'CarPaint'),

    ((select id from series where name = 'BMW X'),
     (select id from body_types where name = 'Внедорожник (SAV)'),
     (select id from fuel_types where name = 'Бензин'),
     'x5-xdrive40i', 'BMW X5 xDrive40i', 2026,
     'Флагманский внедорожник линейки X: место, где семейная практичность встречается со спортом.',
     'xdrive', 381, 5.4, 250, 9500000, '/assets/models/x5.glb', 'CarPaint'),

    ((select id from series where name = 'BMW i'),
     (select id from body_types where name = 'Внедорожник (SAV)'),
     (select id from fuel_types where name = 'Электро'),
     'ix3-suv', 'BMW iX3', 2026,
     'Полностью электрический кроссовер: запас хода на день без остановки на заправке.',
     'xdrive', 286, 6.8, 180, 7900000, null, null);

insert into car_images (car_id, position, path, alt)
select c.id, v.position, format('/assets/cars/%s-%s.webp', c.slug, v.position), v.alt || ' ' || c.name
from cars c
join lateral (
    values (1, 'Вид спереди на'), (2, 'Вид сзади на')
) as v(position, alt) on true;

insert into car_colors (car_id, color_id)
select c.id, col.id
from cars c
join lateral (
    -- каждому автомобилю — Alpine White, Black Sapphire и ещё один цвет
    -- по кругу из оставшихся трёх, чтобы палитра не совпадала у всех подряд
    select id from colors where name = 'Alpine White'
    union all
    select id from colors where name = 'Black Sapphire'
    union all
    (
        select id from colors
        where name not in ('Alpine White', 'Black Sapphire')
        order by (id + c.id) % 3, id
        limit 1
    )
) as col(id) on true;

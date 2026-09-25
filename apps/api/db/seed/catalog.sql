-- =====================================================================
-- CarShowroom — seed каталога. Выполняется после миграций, на пустых
-- таблицах cars/car_images/colors/car_colors (справочники series/
-- body_types/fuel_types уже заполнены миграцией).
--
-- 18 автомобилей BMW, в том числе тюнинг-проекты. У каждого — 3D-модель
-- и фото (D25). Сами файлы лицензированы для некоммерческого использования
-- и в гит не входят: лежат в apps/api/licensed-assets/, а на чистом клоне
-- вместо них отдаются заглушки. Характеристики и цены — правдоподобные
-- демо-значения, а не данные производителя.
-- =====================================================================

insert into colors (name, hex) values
    ('Alpine White',          '#f2f2f0'),
    ('Black Sapphire',        '#0b0b0d'),
    ('Brooklyn Grey',         '#8e9296'),
    ('Frozen Pure Grey',      '#a7aaad'),
    ('Toronto Red',           '#b3161b'),
    ('Aventurine Red',        '#5e1420'),
    ('Valencia Orange',       '#e0561c'),
    ('Estoril Blue',          '#1f5fa8'),
    ('Yas Marina Blue',       '#3f8ed6'),
    ('Tanzanite Blue',        '#1d2a4a'),
    ('Interlagos Blue',       '#26358a'),
    ('British Racing Green',  '#1f4d2b');

insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                  description, drive_type, power_hp, acceleration_s, top_speed_kmh, price,
                  model_3d_path, paint_material)
select s.id, b.id, f.id, v.slug, v.name, v.model_year, v.description, v.drive_type,
       v.power_hp, v.acceleration_s, v.top_speed_kmh, v.price,
       format('/assets/models/%s.glb', v.slug), 'CarPaint'
from (values
    ('BMW M', 'Купе', 'Бензин',
     'm2-zacoe-widebody', 'BMW M2 ZACOE WideBody', 2024,
     'Проект с выставки SEMA: M2 G87 в широком кузове ZACOE, кованые диски и карбоновый аэродинамический обвес.',
     'rwd', 530, 3.9, 285, 11900000),

    ('BMW M', 'Купе', 'Бензин',
     'm2-vorsteiner', 'BMW M2 Vorsteiner VRS Aero', 2024,
     'M2 G87 с карбоновым обвесом Vorsteiner VRS Aero: капот с жабрами, сплиттер и диффузор.',
     'rwd', 480, 4.0, 285, 10400000),

    ('BMW 1 серии', 'Хэтчбек', 'Бензин',
     'm140i', 'BMW M140i', 2018,
     'Последний заднеприводный хэтчбек с рядной «шестёркой» — горячий хэтч в классическом понимании.',
     'rwd', 340, 4.6, 250, 3900000),

    ('BMW 7 серии', 'Седан', 'Бензин',
     '750li-xdrive', 'BMW 750Li xDrive', 2020,
     'Удлинённый представительский седан с V8: заднее место важнее переднего, а тишина — часть роскоши.',
     'xdrive', 530, 4.0, 250, 9800000),

    ('BMW Z', 'Родстер', 'Бензин',
     'z4-sdrive35is', 'BMW Z4 sDrive35is', 2014,
     'Родстер с жёсткой складной крышей и битурбо-«шестёркой» в самой мощной версии E89.',
     'rwd', 340, 4.8, 250, 3200000),

    ('BMW X', 'Внедорожник (SAV)', 'Бензин',
     'x5-xdrive40i', 'BMW X5 xDrive40i', 2024,
     'Флагманский внедорожник линейки X: место, где семейная практичность встречается со спортом.',
     'xdrive', 381, 5.4, 250, 9500000),

    ('BMW 3 серии', 'Седан', 'Бензин',
     'm340i-xdrive', 'BMW M340i xDrive', 2020,
     'Самая быстрая «тройка» до M3: рядная «шестёрка», полный привод и повседневная практичность.',
     'xdrive', 374, 4.4, 250, 6300000),

    ('BMW M', 'Седан', 'Бензин',
     'm3-f80', 'BMW M3 F80', 2015,
     'Первая M3 с турбомотором: четыре двери, задний привод и 431 л.с.',
     'rwd', 431, 4.1, 250, 5200000),

    ('BMW M', 'Купе', 'Бензин',
     'm4-competition', 'BMW M4 Competition', 2025,
     'Актуальное купе M4 в версии Competition с полным приводом M xDrive.',
     'xdrive', 530, 3.5, 290, 12500000),

    ('BMW M', 'Купе', 'Бензин',
     'm4-md4-duke-dynamics', 'BMW M4 MD4 Duke Dynamics', 2014,
     'M4 F82 с обвесом MD4 от Duke Dynamics: капот с воздуховодами и расширенный передний бампер.',
     'rwd', 450, 4.1, 250, 6100000),

    ('BMW M', 'Купе', 'Бензин',
     'm4-lb-works', 'BMW M4 LB★Works', 2014,
     'M4 F82 в расширенном кузове Liberty Walk: накладные арки на заклёпках и заниженная подвеска.',
     'rwd', 450, 4.2, 250, 7400000),

    ('BMW X', 'Кроссовер-купе (SAC)', 'Бензин',
     'x6-xdrive40i', 'BMW X6 xDrive40i', 2020,
     'Кроссовер-купе: силуэт спортивного автомобиля на базе полноразмерного внедорожника.',
     'xdrive', 340, 5.5, 250, 8700000),

    ('BMW i', 'Купе', 'Подключаемый гибрид',
     'i8-3d-design', 'BMW i8 3D Design', 2018,
     'Гибридный спорткар i8 с обвесом 3D Design и большим задним антикрылом.',
     'xdrive', 374, 4.4, 250, 9900000),

    ('BMW 4 серии', 'Гран купе', 'Бензин',
     'm440i-gran-coupe', 'BMW M440i xDrive Gran Coupe', 2022,
     'Четырёхдверное купе: силуэт спорткара и место на заднем ряду для двоих взрослых.',
     'xdrive', 374, 4.7, 250, 7200000),

    ('BMW M', 'Купе', 'Бензин',
     'm3-e46-widebody', 'BMW M3 E46 DTM WideBody', 2004,
     'Классическая M3 E46 с атмосферной «шестёркой» в широком кузове DTM FiberWerkz.',
     'rwd', 343, 5.2, 250, 4800000),

    ('BMW Z', 'Купе', 'Бензин',
     'z4-m-coupe', 'BMW Z4 M Coupe', 2006,
     'Редкое купе Z4 M с мотором от M3 E46 — один из самых «аналоговых» BMW своего времени.',
     'rwd', 343, 5.0, 250, 3600000),

    ('BMW M', 'Кабриолет', 'Бензин',
     'm4-cabrio', 'BMW M4 Cabrio', 2018,
     'M4 со складной жёсткой крышей: те же 431 л.с., но с открытым небом над головой.',
     'rwd', 431, 4.4, 250, 6400000),

    ('BMW i', 'Купе', 'Подключаемый гибрид',
     'i8-lb-works', 'BMW i8 LB★Works', 2019,
     'i8 в расширенном кузове Liberty Walk: гибридный спорткар, превращённый в шоу-кар.',
     'xdrive', 374, 4.4, 250, 11200000)
) as v(series, body_type, fuel_type, slug, name, model_year, description, drive_type,
       power_hp, acceleration_s, top_speed_kmh, price)
join series     s on s.name = v.series
join body_types b on b.name = v.body_type
join fuel_types f on f.name = v.fuel_type;

-- Фото: <slug>-1.webp — обложка, дальше галерея. Количество — сколько
-- снимков есть у автомобиля в licensed-assets/cars.
insert into car_images (car_id, position, path, alt)
select c.id, n, format('/assets/cars/%s-%s.webp', c.slug, n),
       case when n = 1 then c.name else format('%s, фото %s', c.name, n) end
from cars c
join (values
    ('m2-zacoe-widebody', 5), ('m2-vorsteiner', 6), ('m140i', 4),
    ('750li-xdrive', 7), ('z4-sdrive35is', 4), ('x5-xdrive40i', 4),
    ('m340i-xdrive', 5), ('m3-f80', 4), ('m4-competition', 7),
    ('m4-md4-duke-dynamics', 3), ('m4-lb-works', 6), ('x6-xdrive40i', 4),
    ('i8-3d-design', 5), ('m440i-gran-coupe', 4), ('m3-e46-widebody', 5),
    ('z4-m-coupe', 4), ('m4-cabrio', 5), ('i8-lb-works', 3)
) as p(slug, total) on p.slug = c.slug
cross join generate_series(1, p.total) as n;

-- Палитра: цвет с фотографий плюс Alpine White и Black Sapphire.
insert into car_colors (car_id, color_id)
select c.id, col.id
from (values
    ('m2-zacoe-widebody',    'Brooklyn Grey'),
    ('m2-vorsteiner',        'Toronto Red'),
    ('m140i',                'Estoril Blue'),
    ('750li-xdrive',         'Frozen Pure Grey'),
    ('z4-sdrive35is',        'Valencia Orange'),
    ('z4-sdrive35is',        'Toronto Red'),
    ('x5-xdrive40i',         'Frozen Pure Grey'),
    ('m340i-xdrive',         'Tanzanite Blue'),
    ('m340i-xdrive',         'Frozen Pure Grey'),
    ('m3-f80',               'Yas Marina Blue'),
    ('m4-competition',       'Brooklyn Grey'),
    ('m4-md4-duke-dynamics', 'Brooklyn Grey'),
    ('m4-lb-works',          'Frozen Pure Grey'),
    ('x6-xdrive40i',         'Brooklyn Grey'),
    ('i8-3d-design',         'Tanzanite Blue'),
    ('m440i-gran-coupe',     'Aventurine Red'),
    ('m3-e46-widebody',      'British Racing Green'),
    ('z4-m-coupe',           'Interlagos Blue'),
    ('m4-cabrio',            'Toronto Red'),
    ('i8-lb-works',          'Valencia Orange')
) as v(slug, color)
join cars c on c.slug = v.slug
join colors col on col.name = v.color
union
select c.id, col.id
from cars c
cross join colors col
where col.name in ('Alpine White', 'Black Sapphire');

-- =====================================================================
-- CarShowroom — проверка схемы. Выполняется в транзакции с откатом
-- после миграции и seed (apps/api/db/migrations, apps/api/db/seed):
-- данные каталога и тестовые пользователи уже в базе, наши данные
-- в неё не остаются.
--
-- Ничего не адресуется по числовому id: seed мог создать сколько угодно
-- строк, поэтому вся своя тестовая строка ищется по собственным
-- уникальным email/slug, а несуществующие id для проверки внешних
-- ключей берутся заведомо за пределами identity (999999999).
--
-- Проверяем то, что держит БД. Правила записи (часы работы, горизонт,
-- лимит активных записей, переходы статусов) живут в API и проверяются
-- юнит-тестами там, здесь их нет.
-- =====================================================================

begin;

-- Ожидание ошибки: выполняет запрос и сверяет имя нарушенного ограничения.
create function expect_violation(p_sql text, p_constraint text) returns void
language plpgsql as $$
declare
    got text;
begin
    begin
        execute p_sql;
    exception when others then
        got := coalesce(nullif(sqlerrm, ''), sqlstate);
        if position(p_constraint in got) = 0 then
            raise exception 'ожидалось нарушение %, получено: %', p_constraint, got;
        end if;
        return;
    end;
    raise exception 'ожидалось нарушение %, но запрос прошёл: %', p_constraint, p_sql;
end;
$$;


-- ---------------------------------------------------------------------
-- Свои данные: клиент, менеджер и автомобиль, не пересекающиеся с seed
-- по email/slug/name.
-- ---------------------------------------------------------------------

insert into users (name, email, phone, role) values
    ('Смоук клиент',   'smoke-client@example.com',  '+79990000001', 'user'),
    ('Смоук менеджер', 'smoke-manager@example.com', '+79990000002', 'manager');

insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                  description, drive_type, power_hp, acceleration_s, top_speed_kmh, price,
                  model_3d_path, paint_material)
values ((select id from series     where name = 'BMW X'),
        (select id from body_types where name = 'Внедорожник (SAV)'),
        (select id from fuel_types where name = 'Бензин'),
        'smoke-x5-xdrive40i', 'Смоук BMW X5 xDrive40i', 2026, 'Описание', 'xdrive',
        381, 5.4, 250, 9500000, '/assets/models/smoke-x5.glb', 'CarPaint');

insert into car_images (car_id, position, path, alt)
select id, 1, '/assets/cars/smoke-x5-1.webp', 'BMW X5 спереди' from cars where slug = 'smoke-x5-xdrive40i'
union all
select id, 2, '/assets/cars/smoke-x5-2.webp', 'BMW X5 сзади'   from cars where slug = 'smoke-x5-xdrive40i';

insert into colors (name, hex) values
    ('Smoke Alpine White',   '#ffffff'),
    ('Smoke Black Sapphire', '#0b0b0d');

insert into car_colors (car_id, color_id)
select c.id, col.id
from cars c, colors col
where c.slug = 'smoke-x5-xdrive40i'
  and col.name in ('Smoke Alpine White', 'Smoke Black Sapphire');

insert into test_drives (user_id, car_id, starts_at, phone, comment)
select u.id, c.id, date_trunc('hour', now()) + interval '1 day', '+79990000001', 'Первый раз'
from users u, cars c
where u.email = 'smoke-client@example.com' and c.slug = 'smoke-x5-xdrive40i';


-- ---------------------------------------------------------------------
-- Форматы и допустимые значения
-- ---------------------------------------------------------------------

select expect_violation($$
    insert into users (name, email, phone) values ('X', 'SMOKE-BAD@Example.com', '+79990000009')
$$, 'users_email_ck');

select expect_violation($$
    insert into users (name, email, phone) values ('X', 'smoke-x@example.com', '89990000009')
$$, 'users_phone_ck');

select expect_violation($$
    insert into users (name, email, phone, role) values ('X', 'smoke-y@example.com', '+79990000009', 'root')
$$, 'users_role_ck');

select expect_violation($$
    update users set ban_reason = 'спам' where email = 'smoke-client@example.com'
$$, 'users_ban_ck');

select expect_violation($$
    insert into colors (name, hex) values ('Smoke Bad Color', 'ffffff')
$$, 'colors_hex_ck');

select expect_violation($$
    insert into car_images (car_id, position, path, alt)
    select id, 3, '/tmp/x.webp', 'alt' from cars where slug = 'smoke-x5-xdrive40i'
$$, 'car_images_path_ck');

-- Загруженное админом (D26): /media/cars/<carId>/<uuid>.<ext> принимается,
-- а произвольная структура под /media — нет: ключи генерирует только API
insert into car_images (car_id, position, path, alt)
select id, 3, '/media/cars/' || id || '/0b6f3c1e-9d2a-4f5b-8c7d-1e2f3a4b5c6d.webp', 'alt'
from cars where slug = 'smoke-x5-xdrive40i';

select expect_violation($$
    insert into car_images (car_id, position, path, alt)
    select id, 4, '/media/cars/x5/photo.webp', 'alt' from cars where slug = 'smoke-x5-xdrive40i'
$$, 'car_images_path_ck');

select expect_violation($$
    insert into car_images (car_id, position, path, alt)
    select id, 4, '/media/models/' || id || '/0b6f3c1e.webp', 'alt' from cars where slug = 'smoke-x5-xdrive40i'
$$, 'car_images_path_ck');

update cars set model_3d_path = '/media/models/' || id || '/0b6f3c1e-9d2a-4f5b-8c7d-1e2f3a4b5c6d.glb'
where slug = 'smoke-x5-xdrive40i';

select expect_violation($$
    update cars set model_3d_path = '/media/cars/' || id || '/model.glb' where slug = 'smoke-x5-xdrive40i'
$$, 'cars_model_3d_path_ck');

-- Обложка одна: position уникален в пределах автомобиля
select expect_violation($$
    insert into car_images (car_id, position, path, alt)
    select id, 1, '/assets/cars/smoke-x5-3.webp', 'alt' from cars where slug = 'smoke-x5-xdrive40i'
$$, 'car_images_car_position_uq');

-- 3D: путь без имени материала
select expect_violation($$
    update cars set paint_material = null where slug = 'smoke-x5-xdrive40i'
$$, 'cars_model_3d_ck');


-- ---------------------------------------------------------------------
-- Связи
-- ---------------------------------------------------------------------

-- Цвет только из справочника цветов
select expect_violation($$
    insert into car_colors (car_id, color_id)
    select id, 999999999 from cars where slug = 'smoke-x5-xdrive40i'
$$, 'car_colors_color_fk');

-- Один цвет нельзя привязать к автомобилю дважды
select expect_violation($$
    insert into car_colors (car_id, color_id)
    select c.id, col.id from cars c, colors col
    where c.slug = 'smoke-x5-xdrive40i' and col.name = 'Smoke Alpine White'
$$, 'car_colors_pk');

-- Автомобиль только из существующей серии
select expect_violation($$
    insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                      description, drive_type, power_hp, acceleration_s, top_speed_kmh, price)
    values (999999999, 1, 1, 'smoke-ghost', 'Смоук Ghost', 2026, 'X', 'rwd', 100, 9.9, 200, 1000000)
$$, 'cars_series_fk');

-- Запись только на существующий автомобиль
select expect_violation($$
    insert into test_drives (user_id, car_id, starts_at, phone)
    select id, 999999999, date_trunc('hour', now()) + interval '3 days', '+79990000001'
    from users where email = 'smoke-client@example.com'
$$, 'test_drives_car_fk');

-- Автомобиль с историей записей не удаляется
select expect_violation($$
    delete from cars where slug = 'smoke-x5-xdrive40i'
$$, 'test_drives_car_fk');

-- А фото и палитра при удалении автомобиля ушли бы каскадом:
-- проверяем на автомобиле без записей
do $$
declare
    tmp_id bigint;
begin
    insert into cars (series_id, body_type_id, fuel_type_id, slug, name, model_year,
                      description, drive_type, power_hp, acceleration_s, top_speed_kmh, price)
    values (1, 1, 1, 'smoke-tmp-car', 'Смоук Tmp Car', 2026, 'X', 'rwd', 100, 9.9, 200, 1000000)
    returning id into tmp_id;

    insert into car_images (car_id, position, path, alt)
    values (tmp_id, 1, '/assets/cars/smoke-tmp.webp', 'tmp');
    insert into car_colors (car_id, color_id) select tmp_id, id from colors limit 1;

    delete from cars where id = tmp_id;

    if exists (select 1 from car_images where car_id = tmp_id)
       or exists (select 1 from car_colors where car_id = tmp_id) then
        raise exception 'фото и палитра должны удаляться каскадом';
    end if;
end;
$$;


-- ---------------------------------------------------------------------
-- Записи на тест-драйв
-- ---------------------------------------------------------------------

-- Слот автомобиля занят
select expect_violation($$
    insert into test_drives (user_id, car_id, starts_at, phone)
    select u.id, c.id, date_trunc('hour', now()) + interval '1 day', '+79990000002'
    from users u, cars c
    where u.email = 'smoke-manager@example.com' and c.slug = 'smoke-x5-xdrive40i'
$$, 'test_drives_car_slot_uq');

-- Слоты начинаются в начале часа
select expect_violation($$
    insert into test_drives (user_id, car_id, starts_at, phone)
    select u.id, c.id, date_trunc('hour', now()) + interval '2 days 30 minutes', '+79990000001'
    from users u, cars c
    where u.email = 'smoke-client@example.com' and c.slug = 'smoke-x5-xdrive40i'
$$, 'test_drives_slot_ck');

-- Открытая запись не имеет данных закрытия
select expect_violation($$
    update test_drives set closed_at = now()
    where status = 'scheduled' and car_id = (select id from cars where slug = 'smoke-x5-xdrive40i')
$$, 'test_drives_closed_ck');

-- Закрытая запись обязана знать, кто её закрыл
select expect_violation($$
    update test_drives set status = 'completed', closed_at = now()
    where status = 'scheduled' and car_id = (select id from cars where slug = 'smoke-x5-xdrive40i')
$$, 'test_drives_closed_ck');

-- Причина бывает только у отмены
select expect_violation($$
    update test_drives set status = 'completed', closed_at = now(),
                           closed_by = (select id from users where email = 'smoke-manager@example.com'),
                           cancel_reason = 'причина'
    where status = 'scheduled' and car_id = (select id from cars where slug = 'smoke-x5-xdrive40i')
$$, 'test_drives_reason_ck');

-- Нормальный путь: менеджер закрывает запись
update test_drives
   set status = 'completed', closed_at = now(),
       closed_by = (select id from users where email = 'smoke-manager@example.com')
 where status = 'scheduled' and car_id = (select id from cars where slug = 'smoke-x5-xdrive40i');

-- Слот освободился: та же пара (автомобиль, время) снова доступна
insert into test_drives (user_id, car_id, starts_at, phone)
select u.id, c.id, date_trunc('hour', now()) + interval '1 day', '+79990000001'
from users u, cars c
where u.email = 'smoke-client@example.com' and c.slug = 'smoke-x5-xdrive40i';


-- ---------------------------------------------------------------------
-- Представление каталога
-- ---------------------------------------------------------------------

do $$
declare
    item catalog_items;
begin
    select * into strict item from catalog_items where slug = 'smoke-x5-xdrive40i';
    if item.cover_path <> '/assets/cars/smoke-x5-1.webp' then
        raise exception 'обложка должна быть фото с position = 1, получено %', item.cover_path;
    end if;
    if not item.has_3d or item.series_name is null or item.body_type_name is null
       or item.fuel_type_name is null then
        raise exception 'в catalog_items не хватает данных: %', item;
    end if;

    update cars set is_published = false where slug = 'smoke-x5-xdrive40i';
    if exists (select 1 from catalog_items where slug = 'smoke-x5-xdrive40i') then
        raise exception 'неопубликованный автомобиль не должен попадать в каталог';
    end if;
end;
$$;

select 'SMOKE OK' as result;

rollback;

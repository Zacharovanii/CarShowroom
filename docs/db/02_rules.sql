-- =====================================================================
-- CarShowroom — схема БД. Часть 2: правила.
-- Применяется после 01_tables.sql.
-- Обзорный срез схемы по слоям. Источник истины — миграции
-- apps/api/db/migrations; при изменении схемы этот файл правится вслед за ними.
--
-- Справочные данные вынесены в 03_reference_data.sql: правила меняются
-- редко и целиком, справочник — дописыванием строк, и в миграциях это
-- разные файлы.
--
-- В БД остаётся только то, что код не может гарантировать надёжно:
-- форматы и допустимые значения (CHECK), занятость слота (частичный
-- уникальный индекс — он же решает гонку двух одновременных записей),
-- индексы под запросы и справочные данные.
-- Часы работы, горизонт записи, лимит активных записей и переходы
-- статусов проверяет API (apps/api/src/test-drives).
-- =====================================================================


-- =====================================================================
-- 1. CHECK-ограничения
-- =====================================================================

-- Пользователи --------------------------------------------------------

alter table users
    add constraint users_name_ck  check (length(btrim(name)) between 1 and 100),
    add constraint users_email_ck check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    add constraint users_phone_ck check (phone ~ '^\+7[0-9]{10}$'),
    add constraint users_role_ck  check (role in ('user', 'manager', 'admin')),
    -- данные блокировки бывают только у заблокированного
    add constraint users_ban_ck   check (banned or (ban_reason is null and ban_expires is null));

-- Пароль есть только у входа по email и паролю.
alter table accounts
    add constraint accounts_password_ck check ((provider_id = 'credential') = (password is not null));

-- Справочники ---------------------------------------------------------

alter table series
    add constraint series_name_ck     check (length(btrim(name)) > 0),
    add constraint series_position_ck check (position >= 0);

alter table body_types
    add constraint body_types_name_ck     check (length(btrim(name)) > 0),
    add constraint body_types_position_ck check (position >= 0);

alter table fuel_types
    add constraint fuel_types_name_ck     check (length(btrim(name)) > 0),
    add constraint fuel_types_position_ck check (position >= 0);

-- Каталог -------------------------------------------------------------

alter table cars
    add constraint cars_slug_ck        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    add constraint cars_name_ck        check (length(btrim(name)) > 0),
    add constraint cars_year_ck        check (model_year between 2000 and 2100),
    add constraint cars_description_ck check (length(btrim(description)) > 0),
    add constraint cars_drive_ck       check (drive_type in ('rwd', 'xdrive')),
    add constraint cars_specs_ck       check (power_hp > 0 and acceleration_s > 0 and top_speed_kmh > 0),
    add constraint cars_price_ck       check (price > 0),
    -- путь к GLB и имя материала краски имеют смысл только вместе
    add constraint cars_model_3d_ck       check ((model_3d_path is null) = (paint_material is null)),
    -- /assets/... — файлы seed-а; /media/models/<carId>/<uuid>.glb — загружено админом (D26)
    add constraint cars_model_3d_path_ck  check (model_3d_path is null
                                                 or model_3d_path ~ '^/assets/[a-z0-9/_.-]+\.glb$'
                                                 or model_3d_path ~ '^/media/models/[0-9]+/[a-z0-9-]+\.glb$'),
    add constraint cars_paint_material_ck check (paint_material is null or length(btrim(paint_material)) > 0);

alter table car_images
    add constraint car_images_position_ck check (position >= 1),
    -- /assets/... — файлы seed-а; /media/cars/<carId>/<uuid>.<ext> — загружено админом (D26)
    add constraint car_images_path_ck     check (path ~ '^/assets/[a-z0-9/_.-]+\.(webp|avif|jpg|png)$'
                                                 or path ~ '^/media/cars/[0-9]+/[a-z0-9-]+\.(webp|avif|jpg|png)$'),
    add constraint car_images_alt_ck      check (length(btrim(alt)) > 0);

alter table colors
    add constraint colors_name_ck check (length(btrim(name)) > 0),
    add constraint colors_hex_ck  check (hex ~ '^#[0-9a-f]{6}$');

-- Тест-драйвы ---------------------------------------------------------

alter table test_drives
    add constraint test_drives_status_ck    check (status in ('scheduled', 'completed', 'no_show', 'cancelled')),
    add constraint test_drives_phone_ck     check (phone ~ '^\+7[0-9]{10}$'),
    add constraint test_drives_comment_ck   check (comment is null or length(btrim(comment)) between 1 and 500),
    -- слоты начинаются в начале часа (сама сетка часов — в API)
    add constraint test_drives_slot_ck      check (date_trunc('hour', starts_at) = starts_at),
    -- открытая запись не имеет данных закрытия, закрытая — имеет и время, и автора
    add constraint test_drives_closed_ck    check ((status = 'scheduled') = (closed_at is null)
                                                   and (status = 'scheduled') = (closed_by is null)),
    add constraint test_drives_closed_at_ck check (closed_at is null or closed_at >= created_at),
    -- причина бывает только у отмены
    add constraint test_drives_reason_ck    check (cancel_reason is null or status = 'cancelled'),
    add constraint test_drives_reason_len_ck check (cancel_reason is null
                                                    or length(btrim(cancel_reason)) between 1 and 500);


-- =====================================================================
-- 2. Индексы
-- =====================================================================

-- Один слот автомобиля — одна активная запись. Гонку двух одновременных
-- запросов решает БД: второй получает unique_violation (23505),
-- API переводит его в 409 SLOT_TAKEN.
create unique index test_drives_car_slot_uq on test_drives (car_id, starts_at)
    where status = 'scheduled';

-- У клиента не больше одной активной записи на одно время.
create unique index test_drives_user_slot_uq on test_drives (user_id, starts_at)
    where status = 'scheduled';

create index test_drives_starts_at_ix   on test_drives (starts_at);           -- список менеджера
create index test_drives_user_starts_ix on test_drives (user_id, starts_at);  -- «Мои записи», лимит
create index test_drives_closed_by_ix   on test_drives (closed_by);

create index sessions_user_ix            on sessions (user_id);
create index accounts_user_ix            on accounts (user_id);
create index verifications_identifier_ix on verifications (identifier);

create index cars_series_ix      on cars (series_id);      -- фильтры каталога
create index cars_body_type_ix   on cars (body_type_id);
create index cars_fuel_type_ix   on cars (fuel_type_id);
create index car_colors_color_ix on car_colors (color_id);


-- =====================================================================
-- 3. Триггер updated_at (колонки Better Auth)
-- =====================================================================

create function set_updated_at() returns trigger
language plpgsql as $$
begin
    new.updated_at := now();
    return new;
end;
$$;

create trigger users_updated_at         before update on users         for each row execute function set_updated_at();
create trigger sessions_updated_at      before update on sessions      for each row execute function set_updated_at();
create trigger accounts_updated_at      before update on accounts      for each row execute function set_updated_at();
create trigger verifications_updated_at before update on verifications for each row execute function set_updated_at();


-- =====================================================================
-- 4. Представление каталога (производные данные не хранятся)
-- =====================================================================

-- Карточка каталога: подписи справочников, обложка, наличие 3D.
create view catalog_items as
select c.id,
       c.slug,
       c.name,
       c.model_year,
       c.price,
       c.drive_type,
       c.power_hp,
       c.created_at,
       c.series_id,
       s.name  as series_name,
       c.body_type_id,
       bt.name as body_type_name,
       c.fuel_type_id,
       ft.name as fuel_type_name,
       cover.path as cover_path,
       cover.alt  as cover_alt,
       (c.model_3d_path is not null) as has_3d
from cars c
join series     s  on s.id  = c.series_id
join body_types bt on bt.id = c.body_type_id
join fuel_types ft on ft.id = c.fuel_type_id
left join lateral (
    select i.path, i.alt
    from car_images i
    where i.car_id = c.id
    order by i.position
    limit 1
) cover on true
where c.is_published;

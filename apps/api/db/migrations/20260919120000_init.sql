-- migrate:up

-- =====================================================================
-- CarShowroom — первая миграция. Источник — docs/db/*.sql, где схема
-- разбита по слоям (таблицы → правила → справочник) для чтения. Здесь
-- слои схлопнуты: CHECK из docs/db/02_rules.sql перенесены внутрь
-- соответствующих create table, чтобы миграция выглядела как одна
-- готовая схема, а не как её история. Индексы, триггер updated_at,
-- представление каталога и справочные данные остаются отдельными
-- секциями. Пояснения к решениям — docs/db/README.md.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Пользователи и сессии: Better Auth + admin-плагин.
-- Имена таблиц и колонок заданы в конфиге Better Auth (apps/api/src/auth/auth.ts).
-- Состав сверен с `npx @better-auth/cli generate` (spike S2, docs/db/README.md).
-- ---------------------------------------------------------------------

create table users (
    id              uuid        not null default gen_random_uuid(),
    name            text        not null,
    email           text        not null,
    email_verified  boolean     not null default false,
    image           text,
    phone           text        not null,                -- additionalFields
    role            text        not null default 'user', -- admin-плагин: user | manager | admin
    banned          boolean     not null default false,  -- admin-плагин
    ban_reason      text,                                -- admin-плагин
    ban_expires     timestamptz,                         -- admin-плагин
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now(),

    constraint users_pk       primary key (id),
    constraint users_email_uq unique (email),

    constraint users_name_ck  check (length(btrim(name)) between 1 and 100),
    constraint users_email_ck check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    constraint users_phone_ck check (phone ~ '^\+7[0-9]{10}$'),
    constraint users_role_ck  check (role in ('user', 'manager', 'admin')),
    -- данные блокировки бывают только у заблокированного
    constraint users_ban_ck   check (banned or (ban_reason is null and ban_expires is null))
);

create table sessions (
    id               uuid        not null default gen_random_uuid(),
    user_id          uuid        not null,
    token            text        not null,
    expires_at       timestamptz not null,
    ip_address       text,
    user_agent       text,
    impersonated_by  uuid,                 -- admin-плагин: кто из админов вошёл под этим пользователем
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now(),

    constraint sessions_pk                 primary key (id),
    constraint sessions_token_uq           unique (token),
    constraint sessions_user_fk            foreign key (user_id)          references users (id) on delete cascade,
    constraint sessions_impersonated_by_fk foreign key (impersonated_by) references users (id) on delete restrict
);

-- OAuth-колонки (access_token…scope) сейчас всегда null: соцвход выключен (D7),
-- но это часть базовой модели account в Better Auth — колонки нужны структурно,
-- иначе валидация схемы при старте не проходит (npx auth generate, spike S2).
create table accounts (
    id                        uuid        not null default gen_random_uuid(),
    user_id                   uuid        not null,
    provider_id               text        not null,   -- способ входа; у нас всегда 'credential'
    account_id                text        not null,   -- идентификатор на стороне способа входа
    password                  text,                   -- хеш пароля
    access_token              text,
    refresh_token             text,
    id_token                  text,
    access_token_expires_at   timestamptz,
    refresh_token_expires_at  timestamptz,
    scope                     text,
    created_at                timestamptz not null default now(),
    updated_at                timestamptz not null default now(),

    constraint accounts_pk          primary key (id),
    constraint accounts_provider_uq unique (provider_id, account_id),
    constraint accounts_user_fk     foreign key (user_id) references users (id) on delete cascade,

    -- Пароль есть только у входа по email и паролю.
    constraint accounts_password_ck check ((provider_id = 'credential') = (password is not null))
);

-- Не используется (подтверждение email и сброс пароля письмом выключены),
-- но таблица нужна Better Auth. Связей нет намеренно: код выписывается
-- на адрес, которому может ещё не соответствовать ни один пользователь.
create table verifications (
    id          uuid        not null default gen_random_uuid(),
    identifier  text        not null,
    value       text        not null,
    expires_at  timestamptz not null,
    created_at  timestamptz not null default now(),
    updated_at  timestamptz not null default now(),

    constraint verifications_pk primary key (id)
);


-- ---------------------------------------------------------------------
-- Справочники каталога: подпись для интерфейса и порядок в фильтре.
-- Значение фильтра в URL — `id` (см. docs/db/README.md). Порядок строк
-- в данных ниже (секция 3) менять нельзя — только дописывать в конец.
-- ---------------------------------------------------------------------

create table series (
    id        bigint   not null generated by default as identity,
    name      text     not null,
    position  smallint not null,

    constraint series_pk          primary key (id),
    constraint series_name_uq     unique (name),
    constraint series_position_uq unique (position),

    constraint series_name_ck     check (length(btrim(name)) > 0),
    constraint series_position_ck check (position >= 0)
);

create table body_types (
    id        bigint   not null generated by default as identity,
    name      text     not null,
    position  smallint not null,

    constraint body_types_pk          primary key (id),
    constraint body_types_name_uq     unique (name),
    constraint body_types_position_uq unique (position),

    constraint body_types_name_ck     check (length(btrim(name)) > 0),
    constraint body_types_position_ck check (position >= 0)
);

create table fuel_types (
    id        bigint   not null generated by default as identity,
    name      text     not null,
    position  smallint not null,

    constraint fuel_types_pk          primary key (id),
    constraint fuel_types_name_uq     unique (name),
    constraint fuel_types_position_uq unique (position),

    constraint fuel_types_name_ck     check (length(btrim(name)) > 0),
    constraint fuel_types_position_ck check (position >= 0)
);


-- ---------------------------------------------------------------------
-- Каталог. Фиксированный, наполняется seed-ом: управления каталогом в UI нет.
-- Одна строка cars = один автомобиль каталога со своими характеристиками
-- и одной ценой. Он же — ресурс тест-драйва (один демо-автомобиль).
-- ---------------------------------------------------------------------

create table cars (
    id              bigint        not null generated by default as identity,
    series_id       bigint        not null,
    body_type_id    bigint        not null,
    fuel_type_id    bigint        not null,
    slug            text          not null,   -- адрес страницы: /catalog/x5-xdrive40i
    name            text          not null,
    model_year      smallint      not null,
    description     text          not null,
    drive_type      text          not null,   -- rwd | xdrive
    power_hp        smallint      not null,
    acceleration_s  numeric(3,1)  not null,   -- разгон 0–100 км/ч
    top_speed_kmh   smallint      not null,
    price           numeric(12,2) not null,
    model_3d_path   text,                     -- GLB; null — у автомобиля только фото
    paint_material  text,                     -- имя материала краски внутри GLB
    is_published    boolean       not null default true,
    created_at      timestamptz   not null default now(),

    constraint cars_pk              primary key (id),
    constraint cars_slug_uq         unique (slug),
    constraint cars_name_uq         unique (name),
    constraint cars_model_3d_uq     unique (model_3d_path),
    constraint cars_series_fk       foreign key (series_id)    references series     (id) on delete restrict,
    constraint cars_body_type_fk    foreign key (body_type_id) references body_types (id) on delete restrict,
    constraint cars_fuel_type_fk    foreign key (fuel_type_id) references fuel_types (id) on delete restrict,

    constraint cars_slug_ck        check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    constraint cars_name_ck        check (length(btrim(name)) > 0),
    constraint cars_year_ck        check (model_year between 2000 and 2100),
    constraint cars_description_ck check (length(btrim(description)) > 0),
    constraint cars_drive_ck       check (drive_type in ('rwd', 'xdrive')),
    constraint cars_specs_ck       check (power_hp > 0 and acceleration_s > 0 and top_speed_kmh > 0),
    constraint cars_price_ck       check (price > 0),
    -- путь к GLB и имя материала краски имеют смысл только вместе
    constraint cars_model_3d_ck       check ((model_3d_path is null) = (paint_material is null)),
    constraint cars_model_3d_path_ck  check (model_3d_path is null or model_3d_path ~ '^/assets/[a-z0-9/_.-]+\.glb$'),
    constraint cars_paint_material_ck check (paint_material is null or length(btrim(paint_material)) > 0)
);

create table car_images (
    id        bigint   not null generated by default as identity,
    car_id    bigint   not null,
    position  smallint not null,   -- 1 = обложка, отдельного флага нет
    path      text     not null,
    alt       text     not null,

    constraint car_images_pk               primary key (id),
    constraint car_images_path_uq          unique (path),
    -- deferrable: перестановка фото одним update не спотыкается на промежуточном состоянии
    constraint car_images_car_position_uq  unique (car_id, position) deferrable initially immediate,
    constraint car_images_car_fk           foreign key (car_id) references cars (id) on delete cascade,

    constraint car_images_position_ck check (position >= 1),
    constraint car_images_path_ck     check (path ~ '^/assets/[a-z0-9/_.-]+\.(webp|avif|jpg|png)$'),
    constraint car_images_alt_ck      check (length(btrim(alt)) > 0)
);

-- Цвет как таковой: название и оттенок не зависят от автомобиля.
-- Уникально только название: у разных названий бывает один и тот же hex
-- («Alpine White» и «Mineral White» на экране почти неотличимы).
create table colors (
    id    bigint not null generated by default as identity,
    name  text   not null,
    hex   text   not null,

    constraint colors_pk      primary key (id),
    constraint colors_name_uq unique (name),

    constraint colors_name_ck check (length(btrim(name)) > 0),
    constraint colors_hex_ck  check (hex ~ '^#[0-9a-f]{6}$')
);

-- Палитра автомобиля: связь многие-ко-многим между cars и colors.
-- Ключ — сама пара: других атрибутов у связи нет, доплаты за цвет тоже
-- (цвет только перекрашивает материал в 3D-модели).
create table car_colors (
    car_id    bigint not null,
    color_id  bigint not null,

    constraint car_colors_pk       primary key (car_id, color_id),
    constraint car_colors_car_fk   foreign key (car_id)   references cars   (id) on delete cascade,
    constraint car_colors_color_fk foreign key (color_id) references colors (id) on delete restrict
);


-- ---------------------------------------------------------------------
-- Записи на тест-драйв.
-- Слот = starts_at, длительность (60 минут), часы работы и горизонт —
-- константы в API. closed_* заполняются при переходе в конечный статус.
-- ---------------------------------------------------------------------

create table test_drives (
    id             bigint      not null generated by default as identity,
    user_id        uuid        not null,              -- клиент, на кого запись
    car_id         bigint      not null,
    starts_at      timestamptz not null,
    phone          text        not null,              -- контакт для этой записи
    comment        text,
    status         text        not null default 'scheduled', -- scheduled | completed | no_show | cancelled
    closed_at      timestamptz,
    closed_by      uuid,                              -- кто закрыл: клиент или сотрудник
    cancel_reason  text,
    created_at     timestamptz not null default now(),

    constraint test_drives_pk           primary key (id),
    constraint test_drives_user_fk      foreign key (user_id)   references users (id) on delete restrict,
    constraint test_drives_car_fk       foreign key (car_id)    references cars  (id) on delete restrict,
    constraint test_drives_closed_by_fk foreign key (closed_by) references users (id) on delete restrict,

    constraint test_drives_status_ck    check (status in ('scheduled', 'completed', 'no_show', 'cancelled')),
    constraint test_drives_phone_ck     check (phone ~ '^\+7[0-9]{10}$'),
    constraint test_drives_comment_ck   check (comment is null or length(btrim(comment)) between 1 and 500),
    -- слоты начинаются в начале часа (сама сетка часов — в API)
    constraint test_drives_slot_ck      check (date_trunc('hour', starts_at) = starts_at),
    -- открытая запись не имеет данных закрытия, закрытая — имеет и время, и автора
    constraint test_drives_closed_ck    check ((status = 'scheduled') = (closed_at is null)
                                               and (status = 'scheduled') = (closed_by is null)),
    constraint test_drives_closed_at_ck check (closed_at is null or closed_at >= created_at),
    -- причина бывает только у отмены
    constraint test_drives_reason_ck    check (cancel_reason is null or status = 'cancelled'),
    constraint test_drives_reason_len_ck check (cancel_reason is null
                                                or length(btrim(cancel_reason)) between 1 and 500)
);


-- =====================================================================
-- Индексы
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
-- Триггер updated_at (колонки Better Auth)
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
-- Представление каталога (производные данные не хранятся)
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


-- =====================================================================
-- Справочные данные
-- Это часть схемы, а не seed каталога: серии, кузова и типы двигателя
-- существуют независимо от того, есть ли в базе хоть один автомобиль.
-- Seed каталога (cars, car_images, colors) — apps/api/db/seed.
--
-- id не указываются: их выдаёт identity по порядку вставки (1, 2, 3…).
-- Эти id попадают в URL фильтров, поэтому порядок строк ниже менять
-- нельзя — только дописывать в конец.
-- =====================================================================

insert into series (name, position) values
    ('BMW 1 серии',  1),
    ('BMW 2 серии',  2),
    ('BMW 3 серии',  3),
    ('BMW 4 серии',  4),
    ('BMW 5 серии',  5),
    ('BMW 7 серии',  6),
    ('BMW 8 серии',  7),
    ('BMW X',        8),
    ('BMW Z',        9),
    ('BMW i',       10),
    ('BMW M',       11);

insert into body_types (name, position) values
    ('Седан',                1),
    ('Универсал',            2),
    ('Гран купе',            3),
    ('Купе',                 4),
    ('Кабриолет',            5),
    ('Внедорожник (SAV)',    6),
    ('Кроссовер-купе (SAC)', 7),
    ('Хэтчбек',              8),
    ('Родстер',              9);

insert into fuel_types (name, position) values
    ('Бензин',              1),
    ('Дизель',              2),
    ('Подключаемый гибрид', 3),
    ('Электро',             4);


-- migrate:down

drop view if exists catalog_items;

drop table if exists test_drives;
drop table if exists car_colors;
drop table if exists car_images;
drop table if exists cars;

drop table if exists fuel_types;
drop table if exists body_types;
drop table if exists series;

drop table if exists accounts;
drop table if exists sessions;
drop table if exists verifications;
drop table if exists colors;
drop table if exists users;

drop function if exists set_updated_at();

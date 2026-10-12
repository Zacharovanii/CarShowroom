-- migrate:up

-- Каталогом управляет админ (D26): загруженные фото и модели лежат в MinIO,
-- а в БД — путь `/media/<key>`. Ключи генерирует API: `cars/<carId>/<uuid>.<ext>`
-- и `models/<carId>/<uuid>.glb`, поэтому формат здесь уже, чем у `/assets/...`
-- (там пути seed-а, вложенность и `_` допустимы).
-- CHECK нельзя изменить на месте — пересоздаём с тем же именем.

alter table car_images
    drop constraint car_images_path_ck,
    add constraint car_images_path_ck check (
        path ~ '^/assets/[a-z0-9/_.-]+\.(webp|avif|jpg|png)$'
        or path ~ '^/media/cars/[0-9]+/[a-z0-9-]+\.(webp|avif|jpg|png)$'
    );

alter table cars
    drop constraint cars_model_3d_path_ck,
    add constraint cars_model_3d_path_ck check (
        model_3d_path is null
        or model_3d_path ~ '^/assets/[a-z0-9/_.-]+\.glb$'
        or model_3d_path ~ '^/media/models/[0-9]+/[a-z0-9-]+\.glb$'
    );

-- migrate:down

-- Откат упадёт, если в БД уже есть пути `/media/...`: старые CHECK-и их
-- не пропускают. Это намеренно — молча терять загруженные файлы нельзя,
-- такие строки сначала убирают вручную.

alter table car_images
    drop constraint car_images_path_ck,
    add constraint car_images_path_ck check (path ~ '^/assets/[a-z0-9/_.-]+\.(webp|avif|jpg|png)$');

alter table cars
    drop constraint cars_model_3d_path_ck,
    add constraint cars_model_3d_path_ck check (model_3d_path is null or model_3d_path ~ '^/assets/[a-z0-9/_.-]+\.glb$');

// Демо-записи на тест-драйв — по одной на каждый сценарий ручной проверки.
// Даты считаются от «сегодня» по Москве в момент запуска, поэтому набор
// осмысленный в любой день:
//
//   завтра и послезавтра — запланированы: клиент может отменить сам,
//                          менеджер — с причиной (TD-6: у клиента не больше
//                          двух будущих активных — ровно две);
//   вчера                — запланированы, слот прошёл: менеджер ставит
//                          «Пришёл» или «Не явился»;
//   2–3 дня назад        — уже закрыты всеми способами: состоялась, не явился,
//                          отменил клиент, отменил менеджер с причиной.
//
// Прошлые записи через API не создать — он пускает только в будущие слоты
// (TD-5), поэтому сид пишет в таблицу напрямую, как это сделал бы API.

const SALON_TIME_ZONE = "Europe/Moscow";

/** [день от сегодня, час, slug, статус, кто закрыл, причина, комментарий] */
const TEST_DRIVES = [
  [1, 11, "m4-competition", "scheduled", null, null, "Хочу сравнить с M3"],
  [2, 15, "x5-xdrive40i", "scheduled", null, null, null],

  [-1, 10, "i8-3d-design", "scheduled", null, null, "Приеду с женой"],
  [-1, 13, "m3-f80", "scheduled", null, null, null],
  [-1, 16, "z4-m-coupe", "scheduled", null, null, null],

  [-3, 12, "m140i", "completed", "manager", null, null],
  [-3, 14, "750li-xdrive", "no_show", "manager", null, null],
  [-2, 11, "x6-xdrive40i", "cancelled", "client", null, null],
  [-2, 17, "m440i-gran-coupe", "cancelled", "manager", "Автомобиль на плановом обслуживании", null],
];

export async function seedTestDrives(client) {
  const {
    rows: [ids],
  } = await client.query(
    `select (select id from users where email = 'client@carshowroom.test') as client,
            (select id from users where email = 'manager@carshowroom.test') as manager,
            (select phone from users where email = 'client@carshowroom.test') as phone`,
  );
  if (!ids.client || !ids.manager) {
    throw new Error("Нет тестовых пользователей — сначала seedUsers");
  }

  for (const [day, hour, slug, status, closer, reason, comment] of TEST_DRIVES) {
    const closedBy = closer === "manager" ? ids.manager : closer === "client" ? ids.client : null;

    // Слот — полный час по Москве. Создана запись за 3 дня до слота;
    // закрыта: отменённая — за сутки до начала, прошедшая — через час после.
    await client.query(
      `with slot as (
         select (((now() at time zone $1)::date + $2::int) + make_time($3, 0, 0))
                  at time zone $1 as starts_at
       )
       insert into test_drives
         (user_id, car_id, starts_at, phone, comment, status,
          closed_at, closed_by, cancel_reason, created_at)
       select $4, c.id, slot.starts_at, $5, $6, $7,
              case $7 when 'scheduled' then null
                      when 'cancelled' then slot.starts_at - interval '1 day'
                      else slot.starts_at + interval '1 hour' end,
              $8, $9,
              slot.starts_at - interval '3 days'
       from cars c, slot
       where c.slug = $10`,
      [SALON_TIME_ZONE, day, hour, ids.client, ids.phone, comment, status, closedBy, reason, slug],
    );
  }

  console.log(`  ${TEST_DRIVES.length} записей на тест-драйв`);
}

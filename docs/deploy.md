# Выкатка на сервер

Пошаговая инструкция: от пустого VPS до работающего сайта по HTTPS. Команды приведены
полностью, подставить нужно только свои значения (ниже). Почему устроено именно так —
**D28** в [decisions.md](decisions.md), общая схема — в [architecture.md](architecture.md).

Где выполнять команду, сказано перед каждым блоком:

- **на своём компьютере (PowerShell)** — Windows, открытый терминал PowerShell;
- **на сервере** — в SSH-сессии на VPS, под пользователем `deploy`.

Обозначения:

- `IP_СЕРВЕРА` — адрес VPS из панели хостера;
- `ДОМЕН` — адрес сайта, например `cars.example.ru` (действующий экземпляр работает на
  `cars.tda-char.site`); `ПОЧТОВЫЙ_ДОМЕН` — домен, подтверждённый в Resend, обычно
  родительский (`example.ru`);
- `URL_РЕПОЗИТОРИЯ` — адрес git-репозитория проекта;
- `you@example.com` — ваша почта.

---

## 1. Что получится

Caddy сам получает сертификат Let's Encrypt, отдаёт фронт и проксирует в API `/api`,
`/media` и `/assets`. Всё работает в docker compose (`docker/compose.prod.yml`). Наружу
открыты только порты 80 и 443 Caddy; база, MinIO и API доступны лишь внутри сети
compose. Схема — в [architecture.md](architecture.md#развёртывание).

## 2. Что нужно заранее

- **VPS** с Ubuntu 24.04, от 4 ГБ RAM; IP-адрес и пароль `root` из панели хостера.
  10 ГБ диска хватает, но после каждой сборки его надо чистить (шаг 9).
- **Домен** и доступ к его DNS-панели у регистратора.
- **Аккаунт [Resend](https://resend.com)** с подтверждённым `ПОЧТОВЫМ_ДОМЕНОМ`
  (записи SPF и DKIM у регистратора) и API-ключом. Без своего домена письма доходят
  только владельцу аккаунта Resend — подробности в README, раздел
  [«Почта»](../README.md#почта).
- **Каталог `licensed-assets`** — настоящие 3D-модели и фото (D25), с репозиторием не
  распространяется. Не обязателен: без него сайт работает с заглушками, а положить его
  можно и позже (шаг 8).

## 3. Подготовка VPS

Первый вход — под `root` с паролем из панели хостера.

**На своём компьютере (PowerShell):**

```powershell
ssh root@IP_СЕРВЕРА
```

**На сервере** (под `root`): обновить систему и завести пользователя `deploy` с правом
`sudo`. `adduser` спросит пароль — придумать и запомнить, он нужен для `sudo`.

```bash
apt update && apt upgrade -y
adduser deploy
usermod -aG sudo deploy
exit
```

Дальше вход по SSH-ключу, без пароля.

**На своём компьютере (PowerShell):** создать ключ (если `~\.ssh\id_ed25519` уже есть —
пропустить; на вопросы можно отвечать Enter) и скопировать его на сервер. Утилиты
`ssh-copy-id` в Windows нет, поэтому так; последний раз спросит пароль `deploy`.

```powershell
ssh-keygen -t ed25519
type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh deploy@IP_СЕРВЕРА "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
ssh deploy@IP_СЕРВЕРА
```

Последняя команда должна войти без пароля. Все следующие шаги «на сервере» — в этой
сессии, под `deploy`.

**На сервере:** файрвол. `OpenSSH` разрешить **до** `ufw enable`, иначе сессия оборвётся
и войти больше не получится.

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp
sudo ufw enable
sudo ufw status
```

Docker публикует порты в обход ufw. Здесь это не дыра: порты наружу (`ports:`) есть
только у Caddy, остальные сервисы их не объявляют.

## 4. Установка Docker

По официальной инструкции для Ubuntu: https://docs.docker.com/engine/install/ubuntu/ —
если команды ниже перестанут работать, брать оттуда.

**На сервере:**

```bash
sudo apt update
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

sudo tee /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")
Components: stable
Signed-By: /etc/apt/keyrings/docker.asc
EOF

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker deploy
exit
```

`usermod` начинает действовать со следующего входа — поэтому `exit` и снова
`ssh deploy@IP_СЕРВЕРА`. Проверка (**на сервере**), команда без `sudo`:

```bash
docker run --rm hello-world
docker compose version
```

## 5. DNS

В DNS-панели регистратора добавить **A-запись** для `ДОМЕНА` (для `cars.example.ru` —
имя `cars`), значение — `IP_СЕРВЕРА`.

**На своём компьютере (PowerShell):** дождаться, пока запись разойдётся (от минут
до часа), — в ответе должен быть IP сервера.

```powershell
nslookup ДОМЕН
```

Сайт запускать **только после этого**. Caddy при старте сразу просит сертификат, и если
домен ещё не указывает на сервер, Let's Encrypt откажет; после нескольких неудачных
попыток подряд он временно перестаёт принимать запросы для этого домена (лимит — около
пяти неудач в час).

## 6. Код

**На сервере:**

```bash
sudo mkdir -p /opt/carshowroom
sudo chown deploy:deploy /opt/carshowroom
git clone URL_РЕПОЗИТОРИЯ /opt/carshowroom
cd /opt/carshowroom
```

Если репозиторий приватный, `git clone` спросит логин GitHub и вместо пароля —
personal access token (GitHub → Settings → Developer settings → Personal access tokens).

## 7. Переменные окружения: `docker/.env`

Файл лежит **именно в `docker/`**, рядом с `compose.prod.yml`: compose ищет `.env`
в каталоге первого `-f` файла, а не в корне клона. Шаблон с пояснениями —
`docker/.env.prod.example`.

**На сервере** (в `/opt/carshowroom`): сгенерировать секреты и скопировать вывод —
он понадобится в редакторе.

```bash
openssl rand -hex 24      # для POSTGRES_PASSWORD
openssl rand -hex 24      # для MINIO_ROOT_PASSWORD
openssl rand -base64 32   # для BETTER_AUTH_SECRET
```

```bash
cp docker/.env.prod.example docker/.env
nano docker/.env
chmod 600 docker/.env
```

В `nano` заполнить пустые значения; сохранить — Ctrl+O, Enter, выйти — Ctrl+X.

| Переменная | Что вписать |
|---|---|
| `SITE_DOMAIN` | `ДОМЕН` — ровно тот адрес, что будет в браузере |
| `POSTGRES_PASSWORD` | первый `openssl rand -hex 24`. Только буквы и цифры: пароль подставляется в URL базы как есть |
| `MINIO_ROOT_USER` | оставить `carshowroom` |
| `MINIO_ROOT_PASSWORD` | второй `openssl rand -hex 24` (не короче 8 символов) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32`. Dev-секрет из `apps/api/.env` не брать — он в истории гита |
| `RESEND_API_KEY` | ключ из панели Resend (API Keys) |
| `MAIL_FROM` | `"CarShowroom <noreply@ПОЧТОВЫЙ_ДОМЕН>"` — в кавычках, домен подтверждён в Resend |

`WEB_ORIGIN` на проде не нужен: фронт и API на одном адресе. Пароль Postgres задаётся
при **первом** запуске базы; поменять его потом правкой `.env` нельзя — база останется
со старым.

## 8. Модели и фото (`licensed-assets`)

Каталог вне гита (D25), на сервер копируется руками (`git pull` его не трогает). Удобнее до первого запуска;
можно и позже — до этого сайт показывает заглушки.

**На своём компьютере (PowerShell)**, из корня локального клона, где уже лежит
`apps\api\licensed-assets\{cars,models}`. Около 200 МБ — займёт несколько минут.

```powershell
cd C:\путь\к\CarShowroom
scp -r apps\api\licensed-assets deploy@IP_СЕРВЕРА:/opt/carshowroom/apps/api/
```

**На сервере:** проверить раскладку и открыть файлы на чтение — в контейнере их читает
пользователь `node`, не `deploy`.

```bash
ls /opt/carshowroom/apps/api/licensed-assets
# должно быть: cars  models
chmod -R a+rX /opt/carshowroom/apps/api/licensed-assets
```

Если `scp` выполняется **после** первого запуска: docker к тому времени уже создал пустой
каталог `licensed-assets` от `root`, и `scp` ответит `Permission denied`. Перед
копированием — **на сервере**:

```bash
sudo chown -R deploy:deploy /opt/carshowroom/apps/api/licensed-assets
```

Перезапускать ничего не нужно: файлы подхватываются сразу.

## 9. Первый запуск

Все команды — **на сервере**.

**0. Сокращения `compose` и `make-admin`.** Один раз добавить в `~/.bashrc` — дальше
в инструкции команды compose записаны через alias, а функция `make-admin` выдаёт роль
админа (шаг 10):

```bash
cat >> ~/.bashrc <<'END'
alias compose='docker compose -f /opt/carshowroom/docker/compose.prod.yml'
make-admin() { docker compose -f /opt/carshowroom/docker/compose.prod.yml exec api node db/seed/promote-admin.mjs "$1"; }
END
source ~/.bashrc
```

Путь абсолютный, поэтому `compose ps`, `compose logs -f api`, `make-admin` работают из
любой папки; `docker/.env` compose находит рядом с файлом сам. Без alias вместо `compose`
пишите `docker compose -f docker/compose.prod.yml` из `/opt/carshowroom`.

**1. Собрать.** Первая сборка — 5–15 минут.

```bash
cd /opt/carshowroom
compose build
```

**2. Миграции — до запуска API.** `migrate` сам поднимет базу. Порядок важен: Better
Auth при первом запросе сверяет схему, без таблиц отвечает 500 на всё, включая
healthcheck, и запоминает это до перезапуска — `api` не станет healthy, Caddy не
стартует, и миграции после этого не помогут без `restart api`.

```bash
compose run --rm migrate
```

**3. Поднять.**

```bash
compose up -d
compose ps
```

В `ps` у `api` должно быть `(healthy)`, у `caddy`, `db`, `minio` — `Up`. `minio-init`
отрабатывает и выходит, в списке его нет — так и задумано. Если `api` не становится
healthy — шаг 13 (логи) и таблица в шаге 15.

**4. Каталог** — 18 автомобилей, без тестовых пользователей и тест-драйвов.

```bash
compose run --rm api node db/seed/run.mjs --catalog-only
```

**Один раз.** Повторный запуск упадёт с `duplicate key value violates unique constraint
"colors_name_uq"` и откатится — данные не пострадают, но и ничего не добавится.
Флаг `--catalog-only` обязателен: без него в базу попадут тестовые учётки
с публичным паролем `password123`.

**5. Почистить диск** — сборка оставляет кеш на несколько гигабайт.

```bash
docker image prune -f && docker builder prune -f
```

Сайт открывается на `https://ДОМЕН`.

## 10. Первый администратор

Тестовых учёток на проде нет и быть не должно. Админ — это обычный пользователь, которому
повысили роль.

1. На сайте: «Регистрация» своей настоящей почтой.
2. Открыть письмо, перейти по ссылке — адрес подтверждён, вход выполнен.
3. **На сервере:**

   ```bash
   make-admin you@example.com
   ```

   Без функции из шага 9 — то же полной командой:
   `compose exec api node db/seed/promote-admin.mjs you@example.com`.

   Ответ `you@example.com теперь админ. Обновите страницу сайта, чтобы роль применилась.`
4. Обновить страницу — в шапке появятся «Пользователи» и «Автомобили» (админка).
   Выходить и входить заново не нужно.

Что может ответить скрипт:

| Ответ | Что делать |
|---|---|
| `Пользователь ... не найден` | адрес набран не так, или регистрация не прошла |
| `Email не подтверждён` | перейти по ссылке из письма, повторить команду |
| `... уже админ.` | ничего, всё готово |

Менеджеров админ заводит сам в админке; через сайт роль `admin` не назначается (D16).

## 11. Проверка

Пройти руками в браузере, по порядку:

- [ ] Замок в адресной строке, `http://` перебрасывает на `https://`.
- [ ] Каталог показывает автомобили, фильтры работают.
- [ ] Вкладка 3D открывается: настоящая модель, если `licensed-assets` на месте, иначе
      серый седан-заглушка. Проверить файлом (**на сервере**): у
      `curl -sI https://ДОМЕН/assets/models/m4-competition.glb` в
      `content-length` около 11 МБ — настоящая модель, 165 КБ — заглушка.
- [ ] Регистрация с другой почтой → письмо пришло (проверить «Спам») → ссылка → вход.
- [ ] «Забыли пароль?» → письмо → новый пароль → вход с ним.
- [ ] Админка: загрузить фото автомобилю → оно видно на его странице в каталоге.
- [ ] Шесть неверных паролей подряд → «Слишком много попыток, попробуйте через минуту.»
      (ответ 429). Через минуту вход снова работает. Если ограничение срабатывает сразу
      у всех посетителей, а не у одного — что-то не так с прокси (шаг 15).
- [ ] В подвале: «Учебный проект. Не является официальным сайтом BMW.»

## 12. Обновление

**На сервере:**

```bash
cd /opt/carshowroom
git pull
compose build
compose run --rm migrate
compose up -d
docker image prune -f && docker builder prune -f
```

Миграции запускать каждый раз и **до** `up -d`: dbmate применяет только новые, если их
нет — ничего не делает; новый код API стартует уже на новой схеме (шаг 9, п. 2).
Seed при обновлении **не запускать**. `licensed-assets` и `docker/.env`
`git pull` не трогает. Так как кеш сборки чистится, каждая сборка снова полная.

## 13. Логи

**На сервере**, из `/opt/carshowroom`:

```bash
compose logs -f api          # следить за API, выход — Ctrl+C
compose logs --tail 100 caddy # последние 100 строк Caddy
```

Ошибки отправки писем видны в логе API строками `Resend ответил <код>: ...` — там же
причина от Resend (неподтверждённый домен, неверный ключ). Строк `[Mail]` со ссылками,
как в dev, на проде нет: ключ Resend задан, письма уходят по-настоящему. Логи
ограничены — не больше 30 МБ на сервис.

## 14. Резервная копия

**На сервере.** База — в сжатый SQL-файл в домашнем каталоге:

```bash
cd /opt/carshowroom
compose exec -T db pg_dump -U carshowroom carshowroom | gzip > ~/backup-$(date +%F).sql.gz
```

Файлы, загруженные админом (том MinIO; имя тома — имя проекта `carshowroom` + `_minio-data`):

```bash
docker run --rm -v carshowroom_minio-data:/data -v "$HOME":/backup alpine tar czf /backup/minio-$(date +%F).tar.gz -C /data .
```

**На своём компьютере (PowerShell)** — забрать копии себе:

```powershell
scp "deploy@IP_СЕРВЕРА:~/backup-*.gz" .
scp "deploy@IP_СЕРВЕРА:~/minio-*.tar.gz" .
```

Восстановление — на **новом** сервере, пройдя шаги 3–9 до `build` включительно,
но **без** миграций, `up` и seed (дамп уже содержит и схему, и таблицу миграций). Файлы
копий положить в `~` сервера (`scp` в обратную сторону), затем **на сервере** поднять
только базу и MinIO, восстановить, и лишь потом весь стек (API до восстановления схемы
не станет healthy — шаг 9, п. 2):

```bash
cd /opt/carshowroom
compose up -d db minio
gunzip -c ~/backup-ДАТА.sql.gz | compose exec -T db psql -U carshowroom carshowroom
docker run --rm -v carshowroom_minio-data:/data -v "$HOME":/backup alpine tar xzf /backup/minio-ДАТА.tar.gz -C /data
compose up -d
```

`licensed-assets` в копию не входят — их копируют отдельно, как в шаге 8.

## 15. Если что-то пошло не так

| Симптом | Что проверить |
|---|---|
| Браузер ругается на сертификат, сайт не открывается по HTTPS | `nslookup ДОМЕН` отдаёт IP сервера (шаг 5); `sudo ufw status` — открыты 80 и 443; `logs --tail 100 caddy` — причина отказа Let's Encrypt. После исправления: `compose restart caddy` |
| `api` не становится healthy, в логе «Некорректная конфигурация окружения» | Под заголовком перечислены переменные — заполнить их в `docker/.env`, затем `up -d` |
| `up` пишет `container ... api ... is unhealthy`, в логе `api` — `Database schema mismatch` | `up` запущен до миграций. `run --rm migrate`, затем `restart api` и `up -d` |
| `up` пишет «задайте в docker/.env» | Нет `docker/.env` или в нём пустая переменная; файл именно в `docker/`, не в корне |
| `api` падает на подключении к базе | В `POSTGRES_PASSWORD` спецсимволы, или пароль поменяли после первого запуска базы (шаг 7) |
| Вход и регистрация отвечают 403 `INVALID_ORIGIN` | `SITE_DOMAIN` не совпадает с адресом в браузере (например, сайт открыт по IP). Исправить `docker/.env`, `up -d` |
| Письма не приходят | Лог `api`: `Resend ответил ...`. `ПОЧТОВЫЙ_ДОМЕН` в Resend в статусе Verified; `MAIL_FROM` на этом домене и в кавычках; посмотреть «Спам» |
| «Слишком много попыток» у всех посетителей сразу | Кто-то ходит в API мимо Caddy, или перед Caddy поставлен ещё один прокси (Cloudflare) — тогда нужен `trusted_proxies`, решение отдельное |
| Сборка падает с `no space left on device` | `docker system df` — сколько занято; `docker image prune -f && docker builder prune -f`; `sudo journalctl --vacuum-size=100M` |
| В 3D заглушка вместо модели, вместо фото «Фото не установлено» | `ls /opt/carshowroom/apps/api/licensed-assets` — должны быть `cars` и `models`, а не вложенный `licensed-assets`; права — `chmod -R a+rX` (шаг 8) |
| Сайт открывается, но каталог пуст или ошибка | Не выполнены миграции или seed (шаг 9, пункты 2 и 4) |

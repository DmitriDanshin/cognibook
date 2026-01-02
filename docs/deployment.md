# Развёртывание CogniBook

## Требования

- Docker 19.03+
- Docker Compose 1.24+ (или `docker compose` plugin)
- 1 GB RAM минимум
- 2 GB дискового пространства

## Быстрый старт

### 1. Клонирование репозитория

```bash
git clone <repository-url>
cd cognibook
```

### 2. Запуск с Docker Compose

```bash
docker-compose up -d --build
```

Приложение будет доступно на `http://localhost:9999`

## Конфигурация

### Порты

По умолчанию приложение запускается на порту **9999**. Для изменения отредактируйте `docker-compose.yml`:

```yaml
ports:
  - "3000:3000"  # Изменить первое значение на нужный порт
```

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `DATABASE_URL` | Путь к SQLite базе данных | `file:/app/data/dev.db` |
| `PORT` | Порт приложения внутри контейнера | `3000` |

### Volumes (постоянное хранилище)

Docker Compose создаёт два volume для сохранения данных:

- `cognibook_uploads` — загруженные EPUB книги и обложки
- `cognibook_db` — база данных SQLite

Данные сохраняются при перезапуске контейнера.

## Развёртывание на сервере

### Шаг 1: Подготовка сервера

```bash
ssh root@your-server-ip
mkdir -p /opt/cognibook
```

### Шаг 2: Копирование файлов

С локальной машины:

```bash
# Через tar + ssh (без rsync)
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='dev.db' \
    --exclude='uploads' \
    -cvf - . | ssh root@your-server-ip "cd /opt/cognibook && tar -xvf -"

# Или через rsync (если доступен)
rsync -avz --exclude='node_modules' --exclude='.next' --exclude='.git' \
    --exclude='dev.db' --exclude='uploads' \
    ./ root@your-server-ip:/opt/cognibook/
```

### Шаг 3: Сборка и запуск

```bash
ssh root@your-server-ip
cd /opt/cognibook

# Для docker-compose v1
docker-compose up -d --build

# Для docker compose v2
docker compose up -d --build
```

### Шаг 4: Проверка

```bash
docker ps | grep cognibook
curl http://localhost:9999
```

## Управление контейнером

### Просмотр логов

```bash
docker logs cognibook
docker logs -f cognibook  # follow mode
```

### Перезапуск

```bash
docker-compose restart cognibook
```

### Остановка

```bash
docker-compose down
```

### Остановка с удалением данных

```bash
docker-compose down -v  # Удалит volumes!
```

### Обновление приложения

```bash
cd /opt/cognibook
git pull  # или повторить копирование файлов
docker-compose up -d --build
```

## Резервное копирование

### Бэкап базы данных

```bash
docker cp cognibook:/app/data/dev.db ./backup-$(date +%Y%m%d).db
```

### Бэкап загруженных файлов

```bash
docker cp cognibook:/app/uploads ./uploads-backup-$(date +%Y%m%d)
```

### Восстановление

```bash
docker cp ./backup.db cognibook:/app/data/dev.db
docker cp ./uploads-backup/. cognibook:/app/uploads/
docker-compose restart cognibook
```

## Проксирование через Nginx

Для доступа по домену с HTTPS:

```nginx
server {
    listen 80;
    server_name cognibook.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name cognibook.example.com;

    ssl_certificate /etc/letsencrypt/live/cognibook.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/cognibook.example.com/privkey.pem;

    client_max_body_size 100M;  # Для загрузки больших EPUB

    location / {
        proxy_pass http://localhost:9999;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Устранение неполадок

### Контейнер не запускается

```bash
# Проверить логи
docker logs cognibook

# Проверить, свободен ли порт
netstat -tlnp | grep 9999
```

### Ошибка сети при первом запуске

```bash
# Создать сеть вручную
docker network create cognibook_default
docker-compose up -d
```

### Проблемы с правами доступа к файлам

```bash
# Внутри контейнера файлы принадлежат пользователю nextjs (uid 1001)
docker exec cognibook ls -la /app/uploads
```

### Сброс базы данных

```bash
docker-compose down
docker volume rm cognibook_cognibook_db
docker-compose up -d
```

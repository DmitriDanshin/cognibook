# Развёртывание CogniBook

## Требования

- Docker 19.03+
- Docker Compose 1.24+

## Развёртывание на сервере

### 1. Подготовка сервера

```bash
ssh root@your-server-ip
mkdir -p /opt/cognibook
```

### Быстрый деплой (PowerShell)

Для Windows/PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1
```

С параметрами:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy.ps1 -ServerHost your-server-ip -User root -AppDir /opt/cognibook
```


### 2. Копирование файлов

С локальной машины:

```bash
tar --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.git' \
    --exclude='dev.db' \
    --exclude='uploads' \
    -cvf - . | ssh root@your-server-ip "cd /opt/cognibook && tar -xvf -"
```

### 3. Сборка и запуск

```bash
ssh root@your-server-ip
cd /opt/cognibook
docker-compose up -d --build
```

Приложение будет доступно на `http://your-server-ip:9999`

## Конфигурация

### Изменение порта

Отредактируйте `docker-compose.yml`:

```yaml
ports:
  - "3000:3000"  # Изменить первое значение на нужный порт
```

### Volumes

Docker Compose создаёт два volume для сохранения данных:

- `cognibook_uploads` — загруженные EPUB книги
- `cognibook_db` — база данных SQLite

## Управление

```bash
# Логи
docker logs cognibook

# Перезапуск
docker-compose restart cognibook

# Остановка
docker-compose down

# Обновление
cd /opt/cognibook
# повторить копирование файлов (шаг 2)
docker-compose up -d --build
```

## Резервное копирование

```bash
# Бэкап базы данных
docker cp cognibook:/app/data/dev.db ./backup.db

# Бэкап загруженных файлов
docker cp cognibook:/app/uploads ./uploads-backup
```

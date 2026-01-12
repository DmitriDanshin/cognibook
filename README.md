# CogniBook

Веб-приложение для чтения источников (EPUB, Markdown) и прохождения тестов по главам.

## Возможности

- Загрузка и чтение EPUB и Markdown файлов с навигацией по оглавлению
- Создание тестов (JSON) с привязкой к главам источника
- Цитаты из источника в вопросах с переходом к тексту
- Фильтрация тестов по статусу (не начатые / в процессе / пройденные / с ошибками)
- Сохранение прогресса тестов в localStorage

## Стек

- Next.js 15 (App Router)
- Prisma + SQLite
- Tailwind CSS + shadcn/ui

## Запуск

```bash
npm install
npx prisma migrate dev
npm run dev
```

Приложение: http://localhost:3000

## Переменные окружения

- `PINO_LOG_LEVEL` — уровень логов (`debug`, `info`, `warn`, `error`). В dev по умолчанию `debug`.
- `PINO_PRETTY` — включает pretty-логирование в dev (`true`/`false`). По умолчанию включено.

## Развёртывание

См. [docs/deployment.md](docs/deployment.md)

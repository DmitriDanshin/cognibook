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

## Развёртывание

См. [docs/deployment.md](docs/deployment.md)

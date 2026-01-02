# CogniBook

Веб-приложение для чтения EPUB-книг и прохождения тестов по главам.

## Возможности

- Загрузка и чтение EPUB-книг с навигацией по оглавлению
- Создание тестов (JSON) с привязкой к главам книги
- Цитаты из книги в вопросах с переходом к источнику
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

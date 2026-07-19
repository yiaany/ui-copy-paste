# ui-copy-paste (локальный мост)

Локальный HTTP-мост для расширения **UI Copy-Paste**. Принимает сгенерированный
React-компонент от расширения и пишет его в `src/components/<Name>.tsx` вашего
проекта. Работает с любым редактором (Cursor / VS Code / Claude Code / Codex /
OpenCode) — все они файловые.

## Запуск

В корне вашего проекта:

```bash
npx ui-copy-paste
```

Окно нужно оставить открытым. Файлы появятся в `<проект>/src/components/`.
Останови мост через `Ctrl+C`.

## Что делает

- `GET /health` → `200` — расширение проверяет, что мост запущен.
- `POST /write { componentName, code }` → пишет `src/components/<Name>.tsx`.

## Безопасность

Мост слушает только `127.0.0.1:31337` (локально). Запись разрешена **строго**
внутрь `<cwd>/src/components`:

- имя компонента санируется до `[A-Za-z0-9]` (иначе `Component`);
- итоговый путь проверяется на выход за пределы каталога (защита от `../`).

Аутентификации между расширением и мостом нет (MVP — доверенный localhost).

## Сборка из исходников

```bash
pnpm install
pnpm build      # tsc → dist/
pnpm start      # node bin/ui-copy-paste.js
# или без сборки (Node 18+ со strip-types):
pnpm dev
```

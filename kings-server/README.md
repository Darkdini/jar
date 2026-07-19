# kings-server

Авторитарный игровой сервер для Kings (Third World: War of Kings). Правила — по
[`../design/DESIGN.md`](../design/DESIGN.md). Стек: Node.js + TypeScript.

## Запуск
```sh
npm install
npm run sim     # демо-симуляция экономики (печатает расчёты)
npm start       # dev-сервер: TCP JSON-команды на :7070
```

## Команды dev-сервера (JSON построчно)
```json
{"op":"found","owner":"damask","name":"Столица"}
{"op":"build","id":"<castleId>","code":"woodcutter"}
{"op":"state","id":"<castleId>"}
```

## Структура
- `src/model.ts` — типы (ресурсы, здания, замок)
- `src/buildings.ts` — каталог зданий Kings (имена/роли из клиента)
- `src/economy.ts` — движок: добыча, вместимость, цены, ленивый тик, стройка
- `src/sim.ts` — запускаемая демонстрация
- `src/server.ts` — dev-сервер (JSON-протокол — заглушка)

> JSON-протокол здесь временный, для разработки. Реальный fenix-клиент говорит на
> бинарном протоколе — перед этой же логикой встанет **адаптер протокола**
> (реверсится из декомпила клиента).

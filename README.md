# 余烬林：最后一炬

《余烬林：最后一炬》是一款俯视角像素生存冒险浏览器游戏。玩家在雪林里采集资源、升级营火，并前往废磨坊取得炉印。

## 版本

- **第一版 v1.9.0** · 《余烬林 · 像素冒险》的单文件 HTML 版。[发行版](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v1.9.0) · [源码分支](https://github.com/jiangmingyang78-beep/my-codex-game1/tree/v1) · [在 Caffeine 试玩](https://emberwood-visual-effects-m6k.caffeine.xyz/)
- **第二版 v2.0.0** · 《余烬林：最后一炬》的 Phaser 3.90.0 + Vite 版，在 `main` 上开发。当前 MVP 覆盖炉边雪林和废磨坊，进度保存在浏览器的 `localStorage`。[发行版](https://github.com/jiangmingyang78-beep/my-codex-game1/releases/tag/v2.0.0)

## 本地运行

使用 Node.js 22.12+ 或 Node.js 24，以及项目声明的 pnpm 10.26.1。以下命令在仓库根目录运行。

```sh
pnpm install --frozen-lockfile
pnpm --dir src/frontend dev --host 127.0.0.1 --port 5173 --logLevel info
```

打开 [本地开发页](http://127.0.0.1:5173/)。用 WASD 或方向键移动，按 E 互动，按空格攻击，按 Esc 暂停。

```sh
pnpm typecheck
pnpm build
```

生产构建输出在 `src/frontend/dist/`。

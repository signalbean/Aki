# 🌸 Aki

> Your stylish Danbooru-powered image curator for Discord.

<p align="center">
  <a href="https://nodejs.org/"><img alt="Node" src="https://img.shields.io/badge/Node-22.18.0-2ea44f"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9.2-3178c6"></a>
  <a href="https://discord.js.org/"><img alt="Discord.js" src="https://img.shields.io/badge/Discord.js-14.22.1-5865F2"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-yellow.svg"></a>
</p>

---

## 🚀 Quick Start

1. **Clone the repo**

   ```bash
   git clone https://github.com/signalbean/Aki.git
   cd Aki
   ```

2. **Install dependencies**

   ```bash
   npm i
   ```

3. **Configure environment**
   Create a `.env` file in the project root:

   ```env
   TOKEN=discord_bot_token
   CLIENT_ID=bot_client_id
   GUILD_ID=server_id # optional (for dev only)
   ```

4. **Build the project** - Read [Build Notes](#-build-notes) First.

   ```bash
   npm run build
   ```

5. **Start the bot**

   ```bash
   npm run start
   ```

6. **Start in dev**

   ```bash
   npm run dev
   ```

> \[!NOTE]
> Commands may take a few minutes to appear globally. Use a `GUILD_ID` during development for faster testing in a single server.

---

## ⚙️ Configuration

| Key         | Required | Description                               |
| ----------- | -------- | ----------------------------------------- |
| `TOKEN`     | ✅       | Your Discord bot token.                   |
| `CLIENT_ID` | ✅       | Your bot's application (client) ID.       |
| `GUILD_ID`  | ⛔️       | Optional. Guild related stuff during dev. |

<details>
<summary><strong>Where do I find these?</strong></summary>

* **TOKEN**: Discord Developer Portal → Applications → *Your App* → Bot → **Reset Token**
* **CLIENT\_ID**: Developer Portal → Applications → *Your App* → General Information
* **GUILD\_ID**: Right‑click your server → **Copy ID** (enable Developer Mode in Discord settings if needed)

</details>

---

## 🧱 Build Notes

This project used to rely on a script (`coffee-break`) to rewrite TypeScript path aliases. That’s **not included anymore**.

Options if you want aliases:

* Configure `tsconfig.json` and run with `ts-node` in dev.
* Use a bundler (Vite, esbuild, tsup, webpack) to resolve aliases.
* Or just keep it simple with relative paths.

---

## 📜 Documentation

* Full **feature list**, **command reference**, and **troubleshooting** are moved to the [Wiki](https://github.com/signalbean/Aki/wiki).
* The README here is only for install, setup, and build info.

---

## 🤝 Contributing

Issues and PRs are welcome! If proposing a major change, open an issue first.

* Keep PRs focused.
* Add tests or at least a reproducible case.
* Be kind - we’re here for anime pics *and* clean code.

---

## 📜 License

Licensed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

<p align="center"><sub>Built with TypeScript. Runs on vibes. If it breaks, blame the vibes.</sub></p>

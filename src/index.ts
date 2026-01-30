import dotenv from "dotenv";
dotenv.config();

import { Bot, Context } from "grammy";
import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import { Messages } from "./Handlers/Messages";
import { CallbackQuery } from "./Handlers/CallbackQuery";

const bot = new Bot(String(process.env["BOT_TOKEN"]));
const port = Number(process.env["PORT"] || 3000);

bot.on("message", (ctx: NonNullable<Context>) => {
  return Messages.handle(bot, ctx);
});

bot.on("callback_query", (ctx: NonNullable<Context>) => {
  return CallbackQuery.handle(bot, ctx);
});

bot.start({
  drop_pending_updates: true,
  allowed_updates: ["message", "callback_query"],
});
new Elysia({ adapter: node() })
  .get("/", ({ status }) => {
    return status(200, { ok: true, code: 200, message: "Hi!" });
  })
  .listen(port, () => console.log(`Server listening on port: ${port}`));
console.log(`Bot started!`);

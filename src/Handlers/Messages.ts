import { Bot, Context } from "grammy";
import type { Message } from "grammy/types";
import { Helper } from "../Components/Helpers/Helper";
import { markup, btn } from "../Components/Buttons/InlineButton";
import { Cache } from "../Components/Caches/Cache";
import { Game } from "../Components/Games/Game";
import { GameHelper } from "../Components/Games/GameHelper";

const maxPlayers = Number(process.env["MAX_PLAYERS"]);
const joinTime = Number(process.env["JOIN_TIME"]);

export class Messages {
  static handle(bot: Bot, ctx: Context) {
    let match;
    const text = String(ctx.message?.text);
    const chatID = String(ctx.chat?.id);
    const userID = String(ctx.from?.id);

    if ((match = /^\/start\s+join_(.+)/i.exec(text))) {
      const gameID = match[1];
      if (!gameID) return;
      if (Cache.get(`begin_${gameID}`))
        return ctx.reply(`⚠️ The game has already started.`);
      if (Cache.get(`joined_${userID}_${gameID}`))
        return ctx.reply(`⚠️ You have joined this game :)`);
      if (Cache.get(`joined_global_${userID}`))
        return ctx.reply(`⚠️ You can't join more than 1 game.`);
      const groupID = String(Cache.get(`chat_id_${gameID}`));

      Cache.set(`joined_${userID}_${gameID}`, true);
      Cache.set(`joined_global_${userID}`, true);
      ctx.reply(`⏳ Joining...`).then((result_message) => {
        bot.api.getChatMember(groupID, Number(userID)).then((result) => {
          if (!/member|administrator|creator/i.exec(result.status))
            return bot.api.editMessageText(
              userID,
              result_message.message_id,
              `⚠️ You're not a part of ${Helper.clearHTML(String(Cache.get(`group_title_${gameID}`)))}`,
              { parse_mode: "HTML" },
            );
          Cache.set(
            `name_${userID}_${gameID}`,
            Helper.clearHTML(String(ctx.from?.first_name)),
          );
          const getNativePlayers =
            Cache.get<Array<string>>(`native_players_${gameID}`) ?? [];
          getNativePlayers.push(userID);
          Cache.set(`native_players_${gameID}`, getNativePlayers);

          const reGetNativePlayers =
            Cache.get<Array<string>>(`native_players_${gameID}`) ?? [];
          let list = "";

          reGetNativePlayers.map((playerId) => {
            const hasName = Cache.get(`name_${playerId}_${gameID}`);
            list += `\n• <a href='tg://user?id=${playerId}'>${hasName}</a>`;
          });

          var message = `🕵🏻 <b>Spy Game</b>`;
          message += `\nPlayers List:`;
          message += `${list}`;
          message += `\n\nHost: <a href='tg://user?id=${Cache.get(`host_${gameID}`)}'>${Cache.get(`name_${Cache.get(`host_${gameID}`)}_${gameID}`)}</a>`;
          message += `\nTotal: ${reGetNativePlayers!.length}`;
          message += `\nTime left: ${joinTime} second(s).`;
          var keyb = [];
          keyb[0] = [
            btn.url(
              `🕵🏻‍♂️ Join`,
              `https://${process.env["BOT_USERNAME"]}.t.me?start=join_${gameID}`,
            ),
          ];
          keyb[1] = [
            btn.text(`🚀 Begin`, `game_begin_${gameID}`),
            btn.text(`❌ Cancel`, `game_cancel_${gameID}`),
          ];

          bot.api.editMessageText(
            groupID,
            Number(Cache.get(`join_message_id_${groupID}`)),
            message,
            {
              parse_mode: "HTML",
              reply_markup: markup.inlineKeyboard(keyb),
            },
          );
          var keybs = [];
          keybs = [btn.text(`❌ Leave`, `game_leave_${gameID}`)];
          bot.api.editMessageText(
            userID,
            result_message.message_id,
            `✅ You have joined the game in ${Helper.clearHTML(String(Cache.get(`group_title_${gameID}`)))}`,
            {
              parse_mode: "HTML",
              reply_markup: markup.inlineKeyboard(keybs),
            },
          );
          if (reGetNativePlayers!.length == maxPlayers) {
            clearInterval(Cache.get<NodeJS.Timeout>(`join_interval_${gameID}`));
            Cache.set(`begin_${gameID}`, true);
            const tf = [90, 60, 30];
            tf.map((ts) => {
              bot.api
                .deleteMessage(
                  chatID,
                  Number(Cache.get(`time_${ts}_msg_id_${gameID}`)),
                )
                .catch(() => {});
              Cache.del(`time_${ts}_msg_id_${gameID}`);
            });
            bot.api
              .deleteMessage(
                chatID,
                Number(Cache.get(`join_message_id_${groupID}`)),
              )
              .catch(() => {});
            Game.initialize(chatID, bot);
          }
        });
        return;
      });
    }

    var pola = /^\/start$/i;
    if (pola.exec(text)) {
      if (ctx.chat?.type !== "private") return;
      var message = `👋 Hi ${Helper.getName(ctx)}, welcome to this bot! I am a Spy Game Bot.`;
      message += `\n\n<b>🕹 How to play?</b>`;
      message += `\n• Add this bot to your group and play there, minimum is 4 players.`;
      message += `\n• Send the /spy command to start the game.`;
      message += `\n• When the players has reached the minimum or more, press start.`;
      message += `\n• I'll send every players with the same vocabulary, but... only 1-2 player has the different vocabulary.`;
      message += `\n\n<b>🙎‍♂️ Civilian</b>\nYour task is to find who's the spy and win the game.`;
      message += `\n\n<b>🕵️ Spy</b>\nYou're the one who have different vocabulary, your task is to go undercover and win the game.`;
      message += `\n\nBe careful of people you consider friends, they can lie!`;
      var keyb = [];
      keyb = [
        btn.url(
          `↗️ Add me to your group`,
          `https://${process.env["BOT_USERNAME"]}.t.me/?startgroup`,
        ),
      ];

      ctx.reply(message, {
        parse_mode: "HTML",
        reply_markup: markup.inlineKeyboard(keyb),
      });
      return;
    }

    var pola = /^\/quit$/i;
    if (pola.exec(text)) {
      if (!/(group|supergroup)/i.exec(String(ctx.chat?.type))) return;
      ctx.deleteMessage().catch(() => {});
      const gameID = Cache.get<string>(`game_id_${chatID}`);
      if (
        !gameID ||
        !Cache.get(`joined_${userID}_${gameID}`) ||
        Cache.get(`died_${userID}_${gameID}`)
      )
        return;
      ctx.reply(
        `✅ <a href='tg://user?id=${userID}'>${Cache.get(`name_${userID}_${gameID}`)}</a> has left the game, the player was a ${Cache.get(`role_${userID}_${gameID}`)}.`,
        { parse_mode: "HTML" },
      );
      Cache.del(`answer_session_${userID}`);
      GameHelper.pullPlayer(userID, gameID);
      if (Cache.get(`idle_${gameID}`)) {
        const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
        if (getPlayersList!.length <= 0) {
          setTimeout(() => {
            clearInterval(Cache.get<NodeJS.Timeout>(`game_next_${gameID}`));
            Game.next(chatID, gameID, bot);
          }, 1000);
        }
      }
      return;
    }

    var pola = /^\/spy$/i;
    if (pola.exec(text)) {
      if (!/(group|supergroup)/i.exec(String(ctx.chat?.type)))
        return ctx.reply(`⚠️ This command only work in a group.`);
      ctx.deleteMessage().catch(() => {});
      if (Cache.get(`checking_${chatID}`)) return;
      Cache.set(`checking_${chatID}`, true);
      let resultMsg: Message.TextMessage;
      ctx
        .reply(`⏳ Checking availability...`)
        .then((resultMessage) => {
          resultMsg = resultMessage;
          return bot.api.getChatMember(chatID, Number(process.env["BOT_ID"]));
        })
        .then((rightsResult) => {
          if (
            rightsResult.status !== "administrator" ||
            !rightsResult.can_delete_messages ||
            !rightsResult.can_restrict_members
          ) {
            return bot.api.editMessageText(
              chatID,
              resultMsg.message_id,
              `⚠️ I need to be an administrator with delete message and restrict members permission.`,
              { parse_mode: "HTML" },
            );
          }
          if (Cache.get(`game_id_${chatID}`) || Cache.get(`joined_global_${userID}`)) {
            Cache.del(`checking_${chatID}`);
            bot.api
              .deleteMessage(chatID, Number(resultMsg.message_id))
              .catch(() => {});
            return;
          }
          const gameID = `spy${Helper.generateID(20)}`;

          var message = `🕵🏻 <b>Spy Game</b>`;
          message += `\nPlayers List:`;
          message += `\n• <a href='tg://user?id=${userID}'>${Helper.clearHTML(String(ctx.from?.first_name))}</a>`;
          message += `\n\nHost: <a href='tg://user?id=${userID}'>${Helper.clearHTML(String(ctx.from?.first_name))}</a>`;
          message += `\nTotal: 1`;
          message += `\nTime left: ${joinTime} second(s).`;
          var keyb = [];
          keyb[0] = [
            btn.url(
              `🕵🏻‍♂️ Join`,
              `https://${process.env["BOT_USERNAME"]}.t.me?start=join_${gameID}`,
            ),
          ];
          keyb[1] = [
            btn.text(`🚀 Begin`, `game_begin_${gameID}`),
            btn.text(`❌ Cancel`, `game_cancel_${gameID}`),
          ];

          bot.api.editMessageText(chatID, resultMsg.message_id, message, {
            parse_mode: "HTML",
            reply_markup: markup.inlineKeyboard(keyb),
          });
          Cache.set(`join_message_id_${chatID}`, resultMsg.message_id);
          Cache.set(
            `name_${userID}_${gameID}`,
            Helper.clearHTML(String(ctx.from?.first_name)),
          );
          Cache.del(`checking_${chatID}`);
          Cache.set(`joined_${userID}_${gameID}`, true);
          Cache.set(`joined_global_${userID}`, true);
          Cache.set(`host_${gameID}`, userID);
          Cache.set(`game_id_${chatID}`, gameID);
          Cache.set(`chat_id_${gameID}`, chatID);
          Cache.set(`group_title_${gameID}`, ctx.chat?.title);
          Cache.set<Array<string>>(`native_players_${gameID}`, [
            String(ctx.from?.id),
          ]);
          let time = joinTime;
          const t = setInterval(() => {
            time--;

            if (time == 90 || time == 60 || time == 30) {
              ctx
                .reply(`⏳ ${time} second(s) left before the game started.`, {
                  reply_parameters: { message_id: resultMsg.message_id },
                  parse_mode: "HTML",
                })
                .then((r) => {
                  Cache.set(`time_${time}_msg_id_${gameID}`, r.message_id);
                });
            }

            if (time <= 0) {
              clearInterval(t);
              const getPlayersCount = Cache.get<Array<string>>(
                `native_players_${gameID}`,
              );

              Cache.set(`begin_${gameID}`, true);
              bot.api
                .deleteMessage(chatID, Number(resultMsg.message_id))
                .catch(() => {});
              const tf = [90, 60, 30];
              tf.map((ts) => {
                bot.api
                  .deleteMessage(
                    chatID,
                    Number(Cache.get(`time_${ts}_msg_id_${gameID}`)),
                  )
                  .catch(() => {});
                Cache.del(`time_${ts}_msg_id_${gameID}`);
              });

              if (!getPlayersCount || getPlayersCount.length < 4) {
                ctx.reply(`⚠️ There's not enough players to start the game.`);
                GameHelper.removePlayerPropertyMap(gameID);
                GameHelper.removeProperty(chatID, gameID);
                return;
              }

              Cache.set(`begin_${gameID}`, true);
              Game.initialize(chatID, bot);
            }
          }, 1000);
          Cache.set<NodeJS.Timeout>(`join_interval_${gameID}`, t);
        })
        .catch(() => {
          Cache.del(`checking_${chatID}`);
          bot.api.editMessageText(
            chatID,
            resultMsg.message_id,
            `❗️<b>Error!</b>\nCould not initialize the game, something went wrong.`,
            { parse_mode: "HTML" },
          );
        });
      return;
    }

    // SESSION
    const getAnswerSession = Cache.get(`answer_session_${userID}`);
    if (ctx.chat?.type !== "private") return;

    if (getAnswerSession) {
      if (!ctx.message?.text) return;
      const answer = ctx.message.text;
      const groupID = String(getAnswerSession);
      const gameID = String(Cache.get(`game_id_${groupID}`) ?? "null");
      if (gameID == "null") return;
      if (Cache.get(`died_${userID}_${gameID}`)) return;

      Cache.del(`answer_session_${userID}`);
      ctx.reply(`✅ Answer accepted.`);
      bot.api.sendMessage(
        groupID,
        `👍 Player <a href='tg://user?id=${userID}'>${Cache.get<string>(`name_${userID}_${gameID}`)}</a> has answered.`,
        { parse_mode: "HTML" },
      );
      Cache.set(`answer_${userID}_${gameID}`, answer);
      Cache.del(`no_answer_${userID}_${gameID}`);
      const answerCount = Cache.get(`answer_count_${gameID}`);
      const answerData = !answerCount ? 1 : Number(answerCount) + 1;
      Cache.set(`answer_count_${gameID}`, answerData);
      if (
        answerData ===
        Cache.get<Array<string>>(`native_players_${gameID}`)!.length
      ) {
        if (Cache.get(`has_trigger_2_${gameID}`)) return;
        Cache.set(`has_trigger_${gameID}`, true);
        setTimeout(() => {
          clearTimeout(Cache.get<NodeJS.Timeout>(`game_next_${gameID}`));
          Game.next(groupID, gameID, bot);
        }, 1000);
      }
      return;
    }
  }
}

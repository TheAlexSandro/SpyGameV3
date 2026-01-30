import { Bot, Context } from "grammy";
import { Cache } from "../Components/Caches/Cache";
import { Game } from "../Components/Games/Game";
import { GameHelper } from "../Components/Games/GameHelper";
import { markup, btn } from "../Components/Buttons/InlineButton";
import { Helper } from "../Components/Helpers/Helper";

const joinTime = Number(process.env["JOIN_TIME"]);

export class CallbackQuery {
  static handle(bot: Bot, ctx: Context) {
    const cb = ctx.callbackQuery;
    const cbData = String(cb?.data);
    const chatID = String(ctx.chat?.id);
    const userID = String(cb?.from.id);
    let match;

    if ((match = /game_(.+)_(.+)/i.exec(cbData))) {
      const act = match[1];
      const gameID = match[2];
      const groupID = String(Cache.get(`chat_id_${gameID}`) ?? null);
      if (groupID == "null") {
        ctx.deleteMessage().catch(() => {});
        return ctx.answerCallbackQuery({
          text: `⚠️ There's no a game with this ID.`,
          show_alert: true,
        });
      }

      if (act === "begin") {
        if (String(Cache.get(`host_${gameID}`)) !== userID)
          return ctx.answerCallbackQuery({
            text: `⚠️ Unauthorized.`,
            show_alert: true,
          });
        const getPlayersCount = Cache.get<Array<string>>(
          `native_players_${gameID}`,
        );
        if (!getPlayersCount || getPlayersCount.length < 4)
          return ctx.answerCallbackQuery({
            text: `⚠️ There's not enough players to start the game.`,
            show_alert: true,
          });
        clearInterval(Cache.get<NodeJS.Timeout>(`join_interval_${gameID}`));
        Cache.set(`begin_${gameID}`, true);
        ctx.deleteMessage().catch(() => {});
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
        Game.initialize(chatID, bot);
        return;
      }

      if (act == "cancel") {
        if (String(Cache.get(`host_${gameID}`)) !== String(ctx.from?.id))
          return ctx.answerCallbackQuery({
            text: `⚠️ Unauthorized.`,
            show_alert: true,
          });
        ctx.editMessageText(`Game cancelled.`);
        GameHelper.removeProperty(chatID, gameID);
        return;
      }

      if (act == "leave") {
        const playersList = Cache.get<Array<string>>(
          `native_players_${gameID}`,
        );
        const pull = playersList!.filter((p) => p !== userID);
        Cache.set(`native_players_${gameID}`, pull);

        let list = "";
        pull.map((playerId) => {
          const hasName = Cache.get(`name_${playerId}_${gameID}`);
          list += `\n• <a href='tg://user?id=${playerId}'>${hasName}</a>`;
        });

        GameHelper.removePlayerProperty(userID, gameID);
        var message = `🕵🏻‍♂️ <b>Spy Game</b>`;
        message += `\nPlayers List:`;
        message += `${list}`;
        message += `\n\nTotal: ${pull!.length}`;
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
        ctx.editMessageText(
          `✅ You have left the game in ${Helper.clearHTML(String(Cache.get(`group_title_${gameID}`)))}`,
          { parse_mode: "HTML" },
        );
        return;
      }
    }

    if ((match = /vote_(.+)_(.+)/i.exec(cbData))) {
      const playerId = String(match[1]);
      const gameID = String(match[2]);
      const groupID = String(Cache.get(`chat_id_${gameID}`) ?? null);
      if (groupID == "null") {
        ctx.answerCallbackQuery({
          text: `⚠️ There's no a game with this ID.`,
          show_alert: true,
        });
        ctx.deleteMessage().catch(() => {});
        return;
      }

      if (!Cache.get(`joined_${userID}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `You're not in the game.`,
          show_alert: true,
        });
      if (!Cache.get(`vote_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `It's not time to vote.`,
          show_alert: true,
        });
      if (Cache.get(`died_${userID}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `The dead one are not authorized to vote.`,
          show_alert: true,
        });
      if (Cache.get(`has_vote_${userID}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `You have voted for someone.`,
          show_alert: true,
        });
      if (Cache.get(`died_${playerId}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `This player has died.`,
          show_alert: true,
        });

      Cache.set(`has_vote_${userID}_${gameID}`, true);
      GameHelper.addVote(gameID, userID, playerId);
      var message = `🫵 <b>Time to vote!</b>\nWho will you choose?\n\nYou voted for <a href='tg://user?id=${playerId}'>${Cache.get(`name_${playerId}_${gameID}`)}</a>`;
      ctx.editMessageText(message, { parse_mode: "HTML" });
      bot.api.sendMessage(
        groupID,
        `<a href='tg://user?id=${userID}'>${Cache.get(`name_${userID}_${gameID}`)}</a> voted for <a href='tg://user?id=${playerId}'>${Cache.get(`name_${playerId}_${gameID}`)}</a>`,
        { parse_mode: "HTML" },
      );
      const c = Cache.get(`vote_count_${gameID}`);
      Cache.set(`vote_count_${gameID}`, !c ? 1 : Number(c) + 1);
      if (
        Number(Cache.get(`vote_count_${gameID}`)) ==
        Cache.get<Array<string>>(`players_${gameID}`)?.length
      ) {
        clearTimeout(Cache.get<NodeJS.Timeout>(`voting_time_${gameID}`));
        setTimeout(() => {
          Game.decision(groupID, gameID, bot);
        }, 1000);
      }
      return;
    }

    if ((match = /confirm_(.+)_(.+)_(.+)/i.exec(cbData))) {
      const act = String(match[1]);
      const playerId = String(match[2]);
      const gameID = String(match[3]);
      const groupID = String(Cache.get(`chat_id_${gameID}`) ?? null);
      if (groupID == "null") {
        ctx.answerCallbackQuery({
          text: `⚠️ There's no a game with this ID.`,
          show_alert: true,
        });
        ctx.deleteMessage().catch(() => {});
        return;
      }

      if (!Cache.get(`joined_${userID}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `You're not in the game.`,
          show_alert: true,
        });
      if (Cache.get(`died_${userID}_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `The dead one are not authorized to vote.`,
          show_alert: true,
        });
      if (!Cache.get(`confirms_${gameID}`))
        return ctx.answerCallbackQuery({
          text: `The confirmation has already been done.`,
          show_alert: true,
        });
      if (playerId == userID)
        return ctx.answerCallbackQuery({
          text: `You can't vote for yourself.`,
          show_alert: true,
        });
      ctx.answerCallbackQuery(`Accepted!`);
      const { yes, no } = GameHelper.voteConfirm(
        gameID,
        userID,
        act as "yes" | "no",
      );
      var keyb = [];
      keyb = [
        btn.text(`✅ ${yes}`, `confirm_yes_${playerId}_${gameID}`),
        btn.text(`❌ ${no}`, `confirm_no_${playerId}_${gameID}`),
      ];
      ctx
        .editMessageReplyMarkup({ reply_markup: markup.inlineKeyboard(keyb) })
        .catch(() => {});
      const c = Cache.get(`confirm_count_${gameID}`);
      Cache.set(`confirm_count_${gameID}`, !c ? 1 : Number(c) + 1);
      if (
        Number(Cache.get(`confirm_count_${gameID}`)) ==
        Cache.get<Array<string>>(`players_${gameID}`)!.length - 1
      ) {
        clearTimeout(Cache.get<NodeJS.Timeout>(`confirm_time_${gameID}`));
        Game.confirmation(playerId, groupID, gameID, bot);
      }
      return;
    }
  }
}

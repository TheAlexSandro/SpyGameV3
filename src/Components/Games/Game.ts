import { Bot } from "grammy";
import { Cache } from "../Caches/Cache";
import { GameHelper } from "./GameHelper";
import { markup, btn } from "../../Components/Buttons/InlineButton";

const answerTime = Number(process.env["ANSWER_TIME"]);
const pascaTime = Number(process.env["PASCA_TIME"]);
const votingTime = Number(process.env["VOTING_TIME"]);
const confirmTime = Number(process.env["CONFIRM_TIME"]);

export class Game {
  static initialize(chatId: string, bot: Bot) {
    const gameID = Cache.get<string>(`game_id_${chatId}`);
    if (!gameID) return;
    Cache.set(`idle_${gameID}`, true);
    if (!Cache.get(`started_${gameID}`)) {
      bot.api.sendMessage(chatId, `🚀 <b>The Game Begins!</b>`, {
        parse_mode: "HTML",
      });
    }

    const getNativePlayers = Cache.get<Array<string>>(
      `native_players_${gameID}`,
    );
    if (!getNativePlayers) return;
    if (!Cache.get(`started_${gameID}`)) {
      const shuffle = GameHelper.shufflePlayers<string>(getNativePlayers);
      Cache.set<Array<string>>(`players_${gameID}`, shuffle);
      Cache.set(`started_${gameID}`, true);
    }

    const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
    if (!getPlayersList) {
      GameHelper.removeProperty(chatId, gameID);
      return bot.api.sendMessage(
        chatId,
        `⚠️ There's not enough players to start the game. Game cancelled!`,
        { parse_mode: "HTML" },
      );
    }

    const spyTotal = GameHelper.getSpyTotal(getPlayersList.length);
    const civilTotal = getPlayersList.length - spyTotal;

    Cache.set(`spy_total_${gameID}`, spyTotal);
    Cache.set(`civil_total_${gameID}`, civilTotal);

    var message = `🕵️ <b>Spy Game</b>`;
    message += `\nPlayers:`;

    getPlayersList.map((playerId) => {
      const name = Cache.get<string>(`name_${playerId}_${gameID}`);
      message += `\n• <a href='tg://user?id=${playerId}'>${name}</a>`;
    });

    message += `\n\nTime to answer: ${answerTime} second(s)`;
    var keyb: any[] = [];
    keyb = [btn.url(`Open bot`, `https://${process.env["BOT_USERNAME"]}.t.me`)];

    setTimeout(() => {
      bot.api.sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: markup.inlineKeyboard(keyb),
      });

      const playersRole = GameHelper.pickSpy<string>(
        getPlayersList,
        spyTotal,
        gameID,
      );

      playersRole?.civils.map((playerId) => {
        const getWord = GameHelper.getWord(gameID, "civil");
        Cache.set(`answer_session_${playerId}`, chatId);
        Cache.set(`role_assign_${playerId}_${gameID}`, `civil`);
        Cache.set(`role_${playerId}_${gameID}`, `🙎‍♂️ Civillian`);
        const getNoAnswer = Number(
          Cache.get(`no_answer_${playerId}_${gameID}`) ?? 0,
        );
        Cache.set(`no_answer_${playerId}_${gameID}`, getNoAnswer + 1);
        bot.api.sendMessage(
          playerId,
          `✏️ <b>Time to answer!</b>\n🔡 Your word is: <u>${getWord.word}</u>\n📕 Category: <u>${getWord.category}</u>\nYou have to explain your word but don't make it to obvious.\n\nℹ️ <b>Be Carefull!</b>\nAll players got the same category, but the word they get can be very different from yours.`,
          { parse_mode: "HTML" },
        );
      });

      playersRole?.spy.map((playerId) => {
        const getWord = GameHelper.getWord(gameID, "spy");
        Cache.set(`answer_session_${playerId}`, chatId);
        Cache.set(`role_assign_${playerId}_${gameID}`, `spy`);
        Cache.set(`role_${playerId}_${gameID}`, `🕵️ Spy`);
        const getNoAnswer = Number(
          Cache.get(`no_answer_${playerId}_${gameID}`) ?? 0,
        );
        Cache.set(`no_answer_${playerId}_${gameID}`, getNoAnswer + 1);
        bot.api.sendMessage(
          playerId,
          `✏️ <b>Time to answer!</b>\n🔡 Your word is: <u>${getWord.word}</u>\n📕 Category: <u>${getWord.category}</u>\nYou have to explain your word but don't make it to obvious.\n\nℹ️ <b>Be Carefull!</b>\nAll players got the same category, but the word they get can be very different from yours.`,
          { parse_mode: "HTML" },
        );
      });

      const nextTimeout = setTimeout(() => {
        if (Cache.get(`has_trigger_${gameID}`)) return;
        Cache.set(`has_trigger_2_${gameID}`, true);
        this.next(chatId, gameID, bot);
      }, answerTime * 1000);
      Cache.set<NodeJS.Timeout>(`game_next_${gameID}`, nextTimeout);
    }, 1000);

    if (Cache.get(`game_running_interval_${gameID}`)) return;
    let gameTime = 0;
    const gameRunning = setInterval(() => {
      gameTime++;
      Cache.set(`game_time_${gameID}`, gameTime);
    }, 1000);
    Cache.set<NodeJS.Timeout>(`game_running_interval_${gameID}`, gameRunning);
    return;
  }

  static next(chatId: string, gameID: string, bot: Bot) {
    const propertyData = [
      "idle",
      "has_trigger",
      "has_trigger_2",
      "answer_count",
      "vote",
      "vote_list",
      "vote_count",
      "confirm_count",
    ];

    propertyData.map((property) => {
      Cache.del(`${property}_${gameID}`);
    });
    const gameIDs = Cache.get<string>(`game_id_${chatId}`);
    const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
    if (!gameIDs) return;
    if (!getPlayersList) return;

    var msg = `⌛️ <b>Time's Up!</b>`;
    msg += `\nThe time to answer has ended, now it's turn to discuss...`;
    bot.api.sendMessage(chatId, msg, { parse_mode: "HTML" }).then(() => {
      for (const playerId of getPlayersList) {
        const getNoAnswer = Number(
          Cache.get(`no_answer_${playerId}_${gameID}`) ?? 0,
        );

        if (getNoAnswer >= 2) {
          GameHelper.pullPlayer(playerId, gameID);
          bot.api.sendMessage(
            chatId,
            `${Cache.get(`role_${playerId}_${gameID}`)} <a href='tg://user?id=${playerId}'>${Cache.get(`name_${playerId}_${gameID}`)}</a> never answer the question and has been executed.`,
            { parse_mode: "HTML" },
          );
        }
      }

      setTimeout(() => {
        const isDone = GameHelper.checkWinner(gameID);
        if (isDone !== false && isDone !== "next") {
          this.finish(chatId, gameID, bot);
          return;
        }

        var message = `<b>Players:</b>`;
        getPlayersList.map((playerId) => {
          Cache.del(`answer_session_${playerId}`);
          Cache.del(`has_vote_${playerId}_${gameID}`);
          Cache.del(`confirm_vote_${playerId}_${gameID}`);
          const name = Cache.get<string>(`name_${playerId}_${gameID}`);
          message += `\n• <a href='tg://user?id=${playerId}'>${name}</a>`;
          message += `\n└• ${Cache.get(`answer_${playerId}_${gameID}`) ?? "-"}`;
          Cache.del(`answer_${playerId}_${gameID}`);
        });

        message += `\n\nSome of them are:\n🙎‍♂️ Civillian - ${Cache.get(`civil_total_${gameID}`)}, 🕵️ Spy - ${Cache.get(`spy_total_${gameID}`)}`;
        message += `\n\nWho's the spy? I don't know... Make a decision!`;

        bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
        Cache.del(`category_${gameID}`);
        Cache.del(`word_civil_${gameID}`);
        setTimeout(() => {
          this.voting(chatId, gameID, bot);
        }, pascaTime * 1000);
      }, 1000);
    });
    return;
  }

  static voting(chatId: string, gameID: string, bot: Bot) {
    const gameIDs = Cache.get<string>(`game_id_${chatId}`);
    const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
    if (!gameIDs) return;
    if (!getPlayersList) return;

    var message = `🗳 <b>It's voting time!</b>\nTime to vote the suspicious one, make your choices... You got ${votingTime} second(s).`;
    var keyb = [];
    keyb = [
      btn.url(`Open Bot`, `https://${process.env["BOT_USERNAME"]}.t.me/`),
    ];

    bot.api.sendMessage(chatId, message, {
      parse_mode: "HTML",
      reply_markup: markup.inlineKeyboard(keyb),
    });
    Cache.set(`vote_${gameID}`, true);
    getPlayersList.map((playerId) => {
      GameHelper.sendCandidate(playerId, getPlayersList, gameID, bot);
    });
    const t = setTimeout(() => {
      Cache.del(`vote_${gameID}`);
      this.decision(chatId, gameID, bot);
    }, votingTime * 1000);
    Cache.set<NodeJS.Timeout>(`voting_time_${gameID}`, t);
    return;
  }

  static decision(chatId: string, gameID: string, bot: Bot) {
    const gameIDs = Cache.get<string>(`game_id_${chatId}`);
    const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
    if (!gameIDs) return;
    if (!getPlayersList) return;

    const getVotes = GameHelper.getValidMostVoted(gameID);
    if (!getVotes || getVotes == "fair") {
      var message = !getVotes
        ? `🤷‍♂️ <b>No Defendant!</b>\nThe civillians can't make decisions, no defendant should be sentenced to death.`
        : `🤷‍♂️ <b>Taking decision failed!</b>\nThe civillians can't make decisions, no one is sentenced to death.`;

      bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
      setTimeout(() => {
        this.initialize(chatId, bot);
      }, 1000);
      return;
    }

    Cache.set(`confirms_${gameID}`, true);
    const defendant = getVotes?.player;
    var message = `📝 <b>Confirmation</b>\nThe defendant <a href='tg://user?id=${defendant}'>${Cache.get(`name_${defendant}_${gameID}`)}</a> will be executed, are you sure?`;
    var keyb = [];
    keyb = [
      btn.text(`✅ 0`, `confirm_yes_${defendant}_${gameID}`),
      btn.text(`❌ 0`, `confirm_no_${defendant}_${gameID}`),
    ];
    bot.api
      .sendMessage(chatId, message, {
        parse_mode: "HTML",
        reply_markup: markup.inlineKeyboard(keyb),
      })
      .then((resultMessage) => {
        Cache.set(`confirms_msg_id_${gameID}`, resultMessage.message_id);
        const t = setTimeout(() => {
          Game.confirmation(defendant, chatId, gameID, bot);
        }, confirmTime * 1000);
        Cache.set<NodeJS.Timeout>(`confirm_time_${gameID}`, t);
      });
    return;
  }

  static confirmation(
    defendant: string,
    chatId: string,
    gameID: string,
    bot: Bot,
  ) {
    Cache.del(`confirms_${gameID}`);
    bot.api.editMessageText(
      chatId,
      Number(Cache.get(`confirms_msg_id_${gameID}`)),
      `📝 <b>Confirmation</b>\nThe defendant <a href='tg://user?id=${defendant}'>${Cache.get(`name_${defendant}_${gameID}`)}</a> will be executed, are you sure?\n\nIt's done...`,
      { parse_mode: "HTML" },
    );
    const getYes = Number(Cache.get(`confirm_yes_${gameID}`) ?? 0);
    const getNo = Number(Cache.get(`confirm_no_${gameID}`) ?? 0);

    Cache.del(`confirm_yes_${gameID}`);
    Cache.del(`confirm_no_${gameID}`);
    if (getYes < getNo || getYes == getNo) {
      var message = `🤷‍♂️ <b>Taking decision failed!</b>\nThe civillians can't make choices, the defendant is safe.\n\n✅ ${getYes} | ❌ ${getNo}`;

      bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
      this.initialize(chatId, bot);
      return;
    }

    GameHelper.execute(defendant, chatId, gameID, bot, getYes, getNo);
    return;
  }

  static finish(chatId: string, gameID: string, bot: Bot) {
    const gameIDs = Cache.get<string>(`game_id_${chatId}`);
    const getPlayersList = Cache.get<Array<string>>(`native_players_${gameID}`);
    if (!gameIDs) return;
    if (!getPlayersList) return;

    clearInterval(Cache.get<NodeJS.Timeout>(`game_running_interval_${gameID}`));
    const winner = GameHelper.checkWinner(gameID);
    let winnerList = "";
    let list = "";
    getPlayersList.map((playerId) => {
      Cache.del(`answer_session_${playerId}`);
      const getRole = Cache.get(`role_assign_${playerId}_${gameID}`);
      if (winner === getRole && !Cache.get(`died_${playerId}_${gameID}`)) {
        const getName = Cache.get(`name_${playerId}_${gameID}`);
        winnerList += `\n• <a href='tg://user?id=${playerId}'>${getName}</a> - ${Cache.get(`role_${playerId}_${gameID}`)}`;
        GameHelper.removePlayerProperty(playerId, gameID);
      }
    });

    getPlayersList.map((playerId) => {
      const getRole = Cache.get(`role_assign_${playerId}_${gameID}`);
      if (winner !== getRole || Cache.get(`died_${playerId}_${gameID}`)) {
        const getName = Cache.get(`name_${playerId}_${gameID}`);
        list += `\n• <a href='tg://user?id=${playerId}'>${getName}</a> - ${Cache.get(`role_${playerId}_${gameID}`)}`;
        GameHelper.removePlayerProperty(playerId, gameID);
      }
    });

    const winList = !winnerList ? "\nNo one" : winnerList;
    var message = `⛔️ <b>Game Ended!</b>`;
    message += `\n\nWinner:`;
    message += winList;
    message += `\n\nOther Players:`;
    message += list;
    message += `\n\nThe game running for ${Cache.get(`game_time_${gameID}`)} second(s)`;
    bot.api.sendMessage(chatId, message, { parse_mode: "HTML" });
    GameHelper.removeProperty(chatId, gameID);
    return;
  }
}

import { Bot } from "grammy";
import { Cache } from "../Caches/Cache";
import data from "./Words";
import { markup, btn } from "../Buttons/InlineButton";
import { Game } from "./Game";

type Roles = "civil" | "spy";
interface Vote {
  voter: string;
  target: string;
}

interface RoleList {
  spy: string[];
  civils: string[];
}

export class GameHelper {
  static shufflePlayers<T>(array: T[]): T[] {
    const arr = [...array];

    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }

    return arr;
  }

  static getSpyTotal(playersLength: number) {
    if (playersLength <= 6) return 1;
    if (playersLength >= 7 && playersLength <= 9) return 2;
    if (playersLength === 10) return 3;
    return 1;
  }

  static pickSpy<T>(players: T[], spyTotal: number, gameID: string) {
    if (spyTotal >= players.length) return;
    const getList = Cache.get<RoleList>(`role_list_${gameID}`);
    if (getList) {
      return getList;
    } else {
      const shuffled = [...players].sort(() => Math.random() - 0.5);
      const spy = shuffled.slice(0, spyTotal);
      const civils = shuffled.slice(spyTotal);

      Cache.set(`role_list_${gameID}`, { spy, civils });
      return { spy, civils };
    }
  }

  static getWord(gameID: string, role: Roles) {
    let category = Cache.get<string>(`category_${gameID}`);
    let civilWord = Cache.get<string>(`word_civil_${gameID}`);

    if (!category || !civilWord) {
      const randomCategory =
        data.words[Math.floor(Math.random() * data.words.length)];
      category = randomCategory.category;
      const shuffled = [...randomCategory.list].sort(() => Math.random() - 0.5);
      civilWord = shuffled[0];
      Cache.set(`category_${gameID}`, category);
      Cache.set(`word_civil_${gameID}`, civilWord);
    }

    if (role === "civil") {
      return {
        word: civilWord,
        category,
      };
    }
    const categoryData = data.words.find((w) => w.category === category)!;
    let spyWord: string;
    do {
      spyWord =
        categoryData.list[Math.floor(Math.random() * categoryData.list.length)];
    } while (spyWord === civilWord);

    return {
      word: spyWord,
      category,
    };
  }

  static removeProperty(chatId: string, gameId: string) {
    const propertyPrefix = [
      "game_id",
      "chat_id",
      "players",
      "spy_total",
      "civil_total",
      "word_spy",
      "category_spy",
      "word_civil",
      "category_civil",
      "host",
      "game_time",
      "game_running_interval",
      "begin",
      "vote",
      "vote_list",
      "vote_count",
      "voting_time",
      "confirm_time",
      "confirm_count",
      "started",
      "confirms",
      "confirms_msg_id",
      "join_interval",
      "days",
      "idle",
      "has_trigger",
      "has_trigger_2",
    ];

    propertyPrefix.forEach((prefix) => {
      if (prefix === "game_id") {
        Cache.del(`${prefix}_${chatId}`);
      } else {
        Cache.del(`${prefix}_${gameId}`);
      }
    });
  }

  static sendCandidate(
    userId: string,
    playersList: Array<string>,
    gameID: string,
    bot: Bot,
  ) {
    const getPlayersList = Cache.get<Array<string>>(`players_${gameID}`);
    if (!getPlayersList) return;

    const keyb = playersList
      .filter((playerId) => playerId !== userId)
      .map((playerId) => {
        const name = Cache.get<string>(`name_${playerId}_${gameID}`);
        return [btn.text(name!, `vote_${playerId}_${gameID}`)];
      });

    var message = `🫵 <b>Time to vote!</b>\nWho will you choose?`;

    bot.api.sendMessage(userId, message, {
      parse_mode: "HTML",
      reply_markup: markup.inlineKeyboard(keyb),
    });
  }

  static addVote(gameID: string, voter: string, targetId: string) {
    const votes = Cache.get<Vote[]>(`vote_list_${gameID}`) ?? [];
    votes.push({ voter, target: targetId });

    Cache.set(`vote_list_${gameID}`, votes);
  }

  static getValidMostVoted(gameID: string) {
    const votes = Cache.get<Vote[]>(`vote_list_${gameID}`) ?? [];

    if (votes.length === 0) return false;

    const counts: Record<string, number> = {};
    for (const { target } of votes) {
      counts[target] = (counts[target] ?? 0) + 1;
    }

    let max = 0;
    let winners: string[] = [];
    for (const [player, count] of Object.entries(counts)) {
      const c = Number(count);

      if (c > max) {
        max = c;
        winners = [player];
      } else if (c === max) {
        winners.push(player);
      }
    }

    if (winners.length !== 1) return "fair";
    return {
      player: winners[0],
      votes: max,
    };
  }

  static execute(
    playerId: string,
    chatId: string,
    gameID: string,
    bot: Bot,
    getYes: number,
    getNo: number,
  ) {
    const name = Cache.get<string>(`name_${playerId}_${gameID}`);
    bot.api
      .sendMessage(
        chatId,
        `🔫 Executing <a href='tg://user?id=${playerId}'>${name}</a>...\n\n✅ ${getYes} | ❌ ${getNo}`,
        { parse_mode: "HTML" },
      )
      .then(() => {
        this.pullPlayer(playerId, gameID);
        return bot.api.sendMessage(
          chatId,
          `<a href='tg://user?id=${playerId}'>${name}</a> was a ${Cache.get(`role_${playerId}_${gameID}`)}`,
          { parse_mode: "HTML" },
        );
      })
      .then(() => {
        this.removePlayerProperty(playerId, gameID);
        const isDone = this.checkWinner(gameID);
        if (isDone !== false && isDone !== "next") {
          Game.finish(chatId, gameID, bot);
        } else {
          Game.initialize(chatId, bot);
        }
      });
  }

  static pullPlayer(playerId: string, gameID: string) {
    Cache.set(`died_${playerId}_${gameID}`, true);
    const playersList = Cache.get<Array<string>>(`players_${gameID}`);
    const pull = playersList!.filter((p) => p !== playerId);
    Cache.set(`players_${gameID}`, pull);
    this.removePlayer(playerId, gameID);
  }

  static removePlayerPropertyMap(gameID: string) {
    const playersList = Cache.get<Array<string>>(`native_players_${gameID}`);
    playersList!.map((playerId) => {
      this.removePlayerProperty(playerId, gameID);
    });
  }

  static removePlayerProperty(playerId: string, gameID: string) {
    const propertyPrefix = [
      "answer_session",
      "joined",
      "answer",
      "has_vote",
      "confirm_yes",
      "confirm_no",
    ];

    propertyPrefix.forEach((prefix) => {
      Cache.del(`${prefix}_${playerId}_${gameID}`);
    });
    Cache.del(`joined_global_${playerId}`);
  }

  static removePlayer(playerId: string, gameID: string) {
    const roles = Cache.get(`role_list_${gameID}`) as {
      spy: string[];
      civils: string[];
    };
    const upt = {
      spy: roles!.spy.filter((id) => id !== playerId),
      civils: roles!.civils.filter((id) => id !== playerId),
    };

    const spyTotal = upt.spy.length;
    const civilTotal = upt.civils.length;
    Cache.set(`spy_total_${gameID}`, spyTotal);
    Cache.set(`civil_total_${gameID}`, civilTotal);
    Cache.set(`role_list_${gameID}`, upt);
  }

  static checkWinner(gameID: string) {
    const getList = Cache.get<RoleList>(`role_list_${gameID}`);
    if (!getList) return false;
    if (getList.spy.length == 0 && getList.civils.length == 0) return "none";
    if (getList.spy.length == 0 && getList.civils.length >= 1) return "civil";
    if (getList.spy.length == 1 && getList.civils.length == 1) return "spy";
    return "next";
  }

  static voteConfirm(gameID: string, playerId: string, choice: "yes" | "no") {
    const voteKey = `confirm_vote_${playerId}_${gameID}`;
    const yesKey = `confirm_yes_${gameID}`;
    const noKey = `confirm_no_${gameID}`;

    const prevVote = Cache.get<"yes" | "no">(voteKey);

    let yes = Cache.get<number>(yesKey) ?? 0;
    let no = Cache.get<number>(noKey) ?? 0;
    if (prevVote === choice) {
      return { yes, no };
    }

    if (prevVote === "yes") yes--;
    if (prevVote === "no") no--;

    if (choice === "yes") yes++;
    if (choice === "no") no++;

    Cache.set(voteKey, choice);
    Cache.set(yesKey, yes);
    Cache.set(noKey, no);

    return { yes, no };
  }
}

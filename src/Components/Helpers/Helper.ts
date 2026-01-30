import { Bot, Context } from "grammy";

type Callback<T> = (error: null | string, result: T) => void;

export class Helper {
  static getName(ctx: Context): string {
    const id = ctx.from?.id;
    const firstName = this.clearHTML(String(ctx.from?.first_name));
    const username = ctx.from?.username;

    return username
      ? `@${username}`
      : `<a href='tg://user?id=${id}'>${firstName}</a>`;
  }

  static clearHTML(s: string): string {
    return s.replace(/</g, "").replace(/>/g, "");
  }

  static generateID(length: number): string {
    const characters =
      "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const panjangKarakter = characters.length;
    let result = "";

    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * panjangKarakter));
    }

    return result;
  }
}

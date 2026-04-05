declare module "mailparser" {
  export interface ParsedMail {
    subject?: string;
    text?: string;
    html?: string | false;
  }

  export function simpleParser(
    source: string | Buffer | NodeJS.ReadableStream
  ): Promise<ParsedMail>;
}

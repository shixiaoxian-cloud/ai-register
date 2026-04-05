import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

import { getEmailCodeRegex, hasImapConfig, imapConfig, runtimeConfig } from "../env";
import type { EmailVerificationConfig } from "../types";

function matchesFilter(
  value: string | undefined,
  expectedSnippet: string | undefined
): boolean {
  if (!expectedSnippet) {
    return true;
  }

  return (value ?? "").toLowerCase().includes(expectedSnippet.toLowerCase());
}

function extractCode(
  messageText: string,
  emailVerification?: EmailVerificationConfig
): string | null {
  const regex = getEmailCodeRegex(emailVerification);
  const match = regex.exec(messageText);
  if (!match) {
    return null;
  }

  return match[1] ?? match[0] ?? null;
}

export async function waitForEmailCode(
  receivedAfter: Date,
  emailVerification: EmailVerificationConfig,
  timeoutMs: number = runtimeConfig.emailTimeoutMs
): Promise<string> {
  if (!hasImapConfig()) {
    throw new Error(
      "Email verification is enabled, but the active SQLite mail configuration is missing IMAP settings."
    );
  }

  const client = new ImapFlow({
    host: imapConfig.host,
    port: imapConfig.port,
    secure: imapConfig.secure,
    auth: {
      user: imapConfig.user,
      pass: imapConfig.pass
    }
  });

  await client.connect();
  const lock = await client.getMailboxLock(emailVerification.mailbox ?? "INBOX");

  try {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      const searchResult = await client.search({
        since: receivedAfter
      });
      const messageIds = Array.isArray(searchResult) ? searchResult : [];

      const recentIds = [...messageIds].sort((left, right) => right - left).slice(0, 10);

      for await (const message of client.fetch(recentIds, {
        envelope: true,
        source: true,
        internalDate: true
      })) {
        if (message.internalDate && message.internalDate < receivedAfter) {
          continue;
        }

        const fromHeader = message.envelope?.from
          ?.map((entry) => entry.address ?? entry.name ?? "")
          .join(", ");
        const subject = message.envelope?.subject ?? "";

        if (!matchesFilter(fromHeader, emailVerification.fromIncludes)) {
          continue;
        }

        if (!matchesFilter(subject, emailVerification.subjectIncludes)) {
          continue;
        }

        if (!message.source) {
          continue;
        }

        const parsed = await simpleParser(message.source);
        const rawText = [parsed.subject, parsed.text, parsed.html]
          .filter(Boolean)
          .join("\n");
        const code = extractCode(rawText, emailVerification);

        if (code) {
          return code;
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, runtimeConfig.emailPollIntervalMs)
      );
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }

  throw new Error(
    `No matching email code arrived within ${timeoutMs}ms.`
  );
}

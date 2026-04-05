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

function extractCode(messageText: string): string | null {
  const regex = getEmailCodeRegex();
  const match = regex.exec(messageText);
  if (!match) {
    return null;
  }

  return match[1] ?? match[0] ?? null;
}

export async function waitForEmailCode(
  receivedAfter: Date,
  emailVerification: EmailVerificationConfig
): Promise<string> {
  if (!hasImapConfig()) {
    throw new Error(
      "Email verification is enabled, but IMAP settings are incomplete in .env."
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
    const deadline = Date.now() + runtimeConfig.emailTimeoutMs;

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
        const code = extractCode(rawText);

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
    `No matching email code arrived within ${runtimeConfig.emailTimeoutMs}ms.`
  );
}

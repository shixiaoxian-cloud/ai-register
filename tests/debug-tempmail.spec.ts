import { test } from "@playwright/test";
import { createTempMailService } from "../src/email/temp-mail";
import { tempMailConfig } from "../src/env";

/**
 * 自动化调试脚本
 * 用于测试临时邮箱 API 和验证码获取流程
 */
test("调试：测试临时邮箱 API", async () => {
  console.log("========================================");
  console.log("开始调试临时邮箱 API");
  console.log("========================================");
  console.log("");

  // 1. 创建临时邮箱服务
  console.log("步骤 1: 创建临时邮箱服务");
  console.log(`  API Base URL: ${tempMailConfig.baseUrl}`);
  console.log(`  API Key: ${tempMailConfig.apiKey.substring(0, 20)}...`);

  const tempMailService = createTempMailService(
    tempMailConfig.baseUrl,
    tempMailConfig.apiKey
  );
  console.log("  ✓ 服务创建成功");
  console.log("");

  // 2. 创建临时邮箱
  console.log("步骤 2: 创建临时邮箱");
  let mailbox;
  try {
    mailbox = await tempMailService.createMailbox();
    console.log("  ✓ 邮箱创建成功");
    console.log(`  邮箱地址: ${mailbox.full_address}`);
    console.log(`  邮箱 ID: ${mailbox.id}`);
    console.log(`  本地部分: ${mailbox.local_part}`);
    console.log(`  域名: ${mailbox.domain}`);
  } catch (error) {
    console.error("  ✗ 邮箱创建失败:", error);
    throw error;
  }
  console.log("");

  // 3. 测试获取邮件（应该为空）
  console.log("步骤 3: 测试获取邮件列表（应该为空）");
  try {
    const emails = await tempMailService.getEmails(mailbox.id);
    console.log(`  ✓ API 调用成功`);
    console.log(`  邮件数量: ${emails.length}`);
    if (emails.length > 0) {
      console.log("  警告: 新邮箱中已有邮件");
      emails.forEach((email, index) => {
        console.log(`  邮件 ${index + 1}:`);
        console.log(`    From: ${email.from}`);
        console.log(`    Subject: ${email.subject}`);
      });
    }
  } catch (error) {
    console.error("  ✗ 获取邮件失败:", error);
  }
  console.log("");

  // 4. 测试 getLatestEmail API
  console.log("步骤 4: 测试 getLatestEmail API（应该为空）");
  try {
    const latestEmail = await tempMailService.getLatestEmail(mailbox.full_address);
    console.log(`  ✓ API 调用成功`);
    if (latestEmail) {
      console.log(`  警告: 获取到邮件`);
      console.log(`    From: ${latestEmail.from}`);
      console.log(`    Subject: ${latestEmail.subject}`);
    } else {
      console.log(`  ✓ 无邮件（符合预期）`);
    }
  } catch (error) {
    console.error("  ✗ 获取最新邮件失败:", error);
  }
  console.log("");

  // 5. 提示用户发送测试邮件
  console.log("步骤 5: 等待测试邮件");
  console.log(`  请向以下地址发送测试邮件: ${mailbox.full_address}`);
  console.log(`  邮件主题建议: Test verification code`);
  console.log(`  邮件内容建议: Your verification code is: 123456`);
  console.log("");
  console.log("  等待 30 秒后开始轮询...");

  // 等待 30 秒
  await new Promise(resolve => setTimeout(resolve, 30000));
  console.log("");

  // 6. 轮询获取邮件
  console.log("步骤 6: 轮询获取邮件（最多等待 60 秒）");
  try {
    const email = await tempMailService.waitForEmail(mailbox.id, {
      timeout: 60000,  // 60 秒
      interval: 5000,  // 5 秒轮询一次
      emailAddress: mailbox.full_address,
      useLatestApi: true
    });

    console.log("  ✓ 成功获取邮件！");
    console.log(`  From: ${email.from}`);
    console.log(`  To: ${email.to}`);
    console.log(`  Subject: ${email.subject}`);
    console.log(`  Received At: ${email.received_at}`);
    console.log(`  Text Body (前 200 字符):`);
    console.log(`    ${email.text_body?.substring(0, 200)}...`);
    console.log("");

    // 7. 测试验证码提取
    console.log("步骤 7: 测试验证码提取");
    const code = tempMailService.extractVerificationCode(email);
    if (code) {
      console.log(`  ✓ 成功提取验证码: ${code}`);
    } else {
      console.log(`  ✗ 未能提取验证码`);
      console.log(`  邮件内容:`);
      console.log(`    Subject: ${email.subject}`);
      console.log(`    Text: ${email.text_body?.substring(0, 500)}`);
    }
  } catch (error) {
    console.error("  ✗ 轮询超时或失败:", error);
    console.log("");
    console.log("  可能的原因:");
    console.log("  1. 未发送测试邮件");
    console.log("  2. 邮件发送延迟");
    console.log("  3. API 连接问题");
  }
  console.log("");

  // 8. 清理：删除邮箱
  console.log("步骤 8: 清理临时邮箱");
  try {
    await tempMailService.deleteMailbox(mailbox.id);
    console.log("  ✓ 邮箱删除成功");
  } catch (error) {
    console.error("  ✗ 邮箱删除失败:", error);
  }
  console.log("");

  console.log("========================================");
  console.log("调试完成");
  console.log("========================================");
});

test("调试：测试验证码提取逻辑", async () => {
  console.log("========================================");
  console.log("测试验证码提取逻辑");
  console.log("========================================");
  console.log("");

  const tempMailService = createTempMailService(
    tempMailConfig.baseUrl,
    tempMailConfig.apiKey
  );

  // 测试用例
  const testCases = [
    {
      name: "OpenAI 格式（背景色）",
      email: {
        id: "test1",
        from: "no-reply@openai.com",
        to: "test@example.com",
        subject: "Your verification code",
        text_body: "Your code is 123456",
        html_body: '<p style="background-color: #F3F3F3">123456</p>',
        received_at: new Date().toISOString()
      },
      expected: "123456"
    },
    {
      name: "Subject 中的验证码",
      email: {
        id: "test2",
        from: "no-reply@example.com",
        to: "test@example.com",
        subject: "Verification code: 654321",
        text_body: "Please verify your email",
        html_body: "",
        received_at: new Date().toISOString()
      },
      expected: "654321"
    },
    {
      name: "HTML 标签中的验证码",
      email: {
        id: "test3",
        from: "no-reply@example.com",
        to: "test@example.com",
        subject: "Verify your email",
        text_body: "",
        html_body: "<p>Your code is: <strong>789012</strong></p>",
        received_at: new Date().toISOString()
      },
      expected: "789012"
    },
    {
      name: "纯文本中的验证码",
      email: {
        id: "test4",
        from: "no-reply@example.com",
        to: "test@example.com",
        subject: "Email verification",
        text_body: "Your verification code is: 345678\n\nPlease enter this code.",
        html_body: "",
        received_at: new Date().toISOString()
      },
      expected: "345678"
    },
    {
      name: "排除干扰数字 177010",
      email: {
        id: "test5",
        from: "no-reply@example.com",
        to: "test@example.com",
        subject: "Code 177010 is not valid",
        text_body: "Your code is 901234. Ignore 177010.",
        html_body: "",
        received_at: new Date().toISOString()
      },
      expected: "901234"
    }
  ];

  let passedCount = 0;
  let failedCount = 0;

  for (const testCase of testCases) {
    console.log(`测试: ${testCase.name}`);
    const extracted = tempMailService.extractVerificationCode(testCase.email);

    if (extracted === testCase.expected) {
      console.log(`  ✓ 通过: 提取到 ${extracted}`);
      passedCount++;
    } else {
      console.log(`  ✗ 失败: 期望 ${testCase.expected}, 实际 ${extracted}`);
      console.log(`    Subject: ${testCase.email.subject}`);
      console.log(`    Text: ${testCase.email.text_body?.substring(0, 100)}`);
      failedCount++;
    }
    console.log("");
  }

  console.log("========================================");
  console.log(`测试结果: ${passedCount} 通过, ${failedCount} 失败`);
  console.log("========================================");
});

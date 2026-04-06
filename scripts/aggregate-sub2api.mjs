#!/usr/bin/env node

/**
 * Sub2Api 和 CPA 数据下载聚合脚本
 * 用于手动聚合指定任务文件夹或所有任务文件夹的 sub2api 和 cpa 文件
 *
 * 使用方法:
 *   node scripts/aggregate-sub2api.mjs                    # 聚合所有任务文件夹
 *   node scripts/aggregate-sub2api.mjs task-run-xxx       # 聚合指定任务文件夹
 */

import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'fs';
import { join, basename } from 'path';

/**
 * 将 CPA 格式转换为 Sub2Api 格式
 */
function convertCpaToSub2Api(cpaData) {
  if (!cpaData.type || !cpaData.credentials) {
    return null;
  }

  return {
    name: cpaData.email || cpaData.name,
    notes: '',
    platform: cpaData.platform || 'openai',
    type: 'oauth',
    credentials: {
      access_token: cpaData.credentials.access_token || cpaData.access_token,
      refresh_token: cpaData.credentials.refresh_token || cpaData.refresh_token || '',
      expires_in: cpaData.credentials.expires_in || 863999,
      expires_at: cpaData.credentials.expires_at,
      chatgpt_account_id: cpaData.credentials.chatgpt_account_id || cpaData.chatgpt_account_id,
      chatgpt_user_id: cpaData.credentials.chatgpt_user_id || cpaData.chatgpt_user_id,
      organization_id: cpaData.credentials.organization_id || cpaData.organization_id || '',
      client_id: 'app_EMoamEEZ73f0CkXaXp7hrann',
      model_mapping: {
        'gpt-5.1': 'gpt-5.1',
        'gpt-5.1-codex': 'gpt-5.1-codex',
        'gpt-5.1-codex-max': 'gpt-5.1-codex-max',
        'gpt-5.1-codex-mini': 'gpt-5.1-codex-mini',
        'gpt-5.2': 'gpt-5.2',
        'gpt-5.2-codex': 'gpt-5.2-codex',
        'gpt-5.3': 'gpt-5.3',
        'gpt-5.3-codex': 'gpt-5.3-codex',
        'gpt-5.4': 'gpt-5.4',
        'gpt-5.4-mini': 'gpt-5.4-mini'
      }
    },
    extra: {
      email: cpaData.extra?.email || cpaData.email,
      password: cpaData.extra?.password || ''
    },
    group_ids: [2],
    concurrency: 10,
    priority: 1,
    rate_multiplier: 1,
    auto_pause_on_expired: true
  };
}

/**
 * 聚合单个任务文件夹的 CPA 文件并转换为 Sub2Api 格式
 */
function aggregateFiles(taskDir) {
  try {
    const cpaDir = join(taskDir, 'cpa');
    let allAccounts = [];

    // 只读取 CPA 文件并转换为 Sub2Api 格式
    if (existsSync(cpaDir)) {
      const cpaFiles = readdirSync(cpaDir)
        .filter(file => file.endsWith('.json'))
        .map(file => join(cpaDir, file));

      for (const filePath of cpaFiles) {
        try {
          const content = readFileSync(filePath, 'utf8');
          const data = JSON.parse(content);

          const sub2apiAccount = convertCpaToSub2Api(data);
          if (sub2apiAccount) {
            allAccounts.push(sub2apiAccount);
          }
        } catch (error) {
          console.error(`读取 CPA 文件失败 ${filePath}:`, error.message);
        }
      }
    }

    if (allAccounts.length === 0) {
      return null;
    }

    // 构建汇总 payload
    const aggregatedPayload = {
      proxies: [],
      accounts: allAccounts
    };

    // 生成汇总文件名
    const taskName = basename(taskDir);
    const outputFilePath = join(taskDir, `${taskName}.sub2api.json`);

    // 保存汇总文件
    writeFileSync(
      outputFilePath,
      JSON.stringify(aggregatedPayload, null, 2),
      'utf8'
    );

    console.log(`✓ ${taskName}: ${allAccounts.length} 个账号（从 CPA 格式转换）`);

    return outputFilePath;
  } catch (error) {
    console.error('聚合文件失败:', error.message);
    return null;
  }
}

/**
 * 聚合所有任务文件夹
 */
function aggregateAllTaskDirs(baseOutputDir) {
  const aggregatedFiles = [];

  try {
    if (!existsSync(baseOutputDir)) {
      console.log(`输出目录不存在: ${baseOutputDir}`);
      return aggregatedFiles;
    }

    // 查找所有 task-run-* 目录
    const entries = readdirSync(baseOutputDir, { withFileTypes: true });
    const taskDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('task-run-'))
      .map(entry => join(baseOutputDir, entry.name));

    if (taskDirs.length === 0) {
      console.log('没有找到任务文件夹');
      return aggregatedFiles;
    }

    console.log(`正在聚合 ${taskDirs.length} 个任务文件夹...\n`);

    // 为每个任务文件夹生成汇总文件
    for (const taskDir of taskDirs) {
      const aggregatedFile = aggregateFiles(taskDir);
      if (aggregatedFile) {
        aggregatedFiles.push(aggregatedFile);
      }
    }

    console.log(`\n✓ 完成! 共生成 ${aggregatedFiles.length} 个汇总文件`);
  } catch (error) {
    console.error('批量聚合失败:', error.message);
  }

  return aggregatedFiles;
}

// 主函数
function main() {
  const args = process.argv.slice(2);
  const baseOutputDir = process.env.TOKEN_OUTPUT_DIR || './output_tokens';

  if (args.length === 0) {
    // 聚合所有任务文件夹
    aggregateAllTaskDirs(baseOutputDir);
  } else {
    // 聚合指定任务文件夹
    const taskName = args[0];
    const taskDir = taskName.startsWith('task-run-')
      ? join(baseOutputDir, taskName)
      : join(baseOutputDir, `task-run-${taskName}`);

    if (!existsSync(taskDir) || !statSync(taskDir).isDirectory()) {
      console.error(`错误: 任务文件夹不存在: ${taskDir}`);
      process.exit(1);
    }

    aggregateFiles(taskDir);
  }
}

main();

/**
 * Sub2Api 汇总模块
 * 用于将任务文件夹中的多个 sub2api 文件合并成一个汇总文件
 */

import * as fs from 'fs';
import * as path from 'path';
import type { Sub2ApiPayload } from './token-saver';

/**
 * 聚合任务文件夹中所有 sub2api 文件的 accounts
 */
export async function aggregateSub2ApiFiles(
  taskDir: string
): Promise<string | null> {
  try {
    const sub2apiDir = path.join(taskDir, 'sub2api');

    // 检查 sub2api 目录是否存在
    if (!fs.existsSync(sub2apiDir)) {
      console.log(`Sub2Api 目录不存在: ${sub2apiDir}`);
      return null;
    }

    // 读取所有 .sub2api.json 文件
    const files = fs.readdirSync(sub2apiDir)
      .filter(file => file.endsWith('.sub2api.json'))
      .map(file => path.join(sub2apiDir, file));

    if (files.length === 0) {
      console.log(`没有找到 sub2api 文件: ${sub2apiDir}`);
      return null;
    }

    console.log(`找到 ${files.length} 个 sub2api 文件，开始聚合...`);

    // 聚合所有 accounts
    const allAccounts: any[] = [];

    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const data: Sub2ApiPayload = JSON.parse(content);

        if (data.accounts && Array.isArray(data.accounts)) {
          allAccounts.push(...data.accounts);
          console.log(`  - ${path.basename(filePath)}: ${data.accounts.length} 个账号`);
        }
      } catch (error) {
        console.error(`读取文件失败 ${filePath}:`, error);
      }
    }

    if (allAccounts.length === 0) {
      console.log('没有找到任何账号数据');
      return null;
    }

    // 构建汇总 payload
    const aggregatedPayload: Sub2ApiPayload = {
      proxies: [],
      accounts: allAccounts
    };

    // 生成汇总文件名（使用任务文件夹名称）
    const taskName = path.basename(taskDir);
    const outputFilePath = path.join(taskDir, `${taskName}.sub2api.json`);

    // 保存汇总文件
    fs.writeFileSync(
      outputFilePath,
      JSON.stringify(aggregatedPayload, null, 2),
      'utf8'
    );

    console.log(`✓ Sub2Api 汇总文件已生成: ${outputFilePath}`);
    console.log(`  总计: ${allAccounts.length} 个账号`);

    return outputFilePath;
  } catch (error) {
    console.error('聚合 Sub2Api 文件失败:', error);
    return null;
  }
}

/**
 * 自动检测并聚合所有任务文件夹的 sub2api 文件
 */
export async function aggregateAllTaskDirs(
  baseOutputDir: string
): Promise<string[]> {
  const aggregatedFiles: string[] = [];

  try {
    if (!fs.existsSync(baseOutputDir)) {
      console.log(`输出目录不存在: ${baseOutputDir}`);
      return aggregatedFiles;
    }

    // 查找所有 task-run-* 目录
    const entries = fs.readdirSync(baseOutputDir, { withFileTypes: true });
    const taskDirs = entries
      .filter(entry => entry.isDirectory() && entry.name.startsWith('task-run-'))
      .map(entry => path.join(baseOutputDir, entry.name));

    if (taskDirs.length === 0) {
      console.log('没有找到任务文件夹');
      return aggregatedFiles;
    }

    console.log(`找到 ${taskDirs.length} 个任务文件夹`);

    // 为每个任务文件夹生成汇总文件
    for (const taskDir of taskDirs) {
      const aggregatedFile = await aggregateSub2ApiFiles(taskDir);
      if (aggregatedFile) {
        aggregatedFiles.push(aggregatedFile);
      }
    }

    console.log(`\n✓ 完成! 共生成 ${aggregatedFiles.length} 个汇总文件`);
  } catch (error) {
    console.error('批量聚合失败:', error);
  }

  return aggregatedFiles;
}

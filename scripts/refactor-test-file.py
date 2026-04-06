#!/usr/bin/env python3
"""
自动重构 protection-validation.spec.ts 文件
删除已迁移到模块的重复函数
"""

import re

def remove_duplicate_functions(content):
    """删除已迁移到模块的重复函数"""

    # 要删除的函数列表（按出现顺序）
    functions_to_remove = [
        # common/outcome-recorder.ts
        (r'async function attachSummary\([^)]+\)[^{]*\{[^}]*\}', 'attachSummary'),
        (r'function getStageLabel\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'getStageLabel'),
        (r'function recordOutcome\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'recordOutcome'),

        # common/error-handling.ts
        (r'class RetryableRegistrationFailure extends Error \{[\s\S]*?\n\}', 'RetryableRegistrationFailure'),
        (r'async function detectRegistrationFailure\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'detectRegistrationFailure'),
        (r'async function throwIfRegistrationFailed\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'throwIfRegistrationFailed'),
        (r'function getErrorMessage\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'getErrorMessage'),
        (r'function isEmailWaitTimeoutError\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'isEmailWaitTimeoutError'),

        # common/page-helpers.ts
        (r'async function fillPasswordIfVisible\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'fillPasswordIfVisible'),
        (r'async function isPreAuthChallengePage\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'isPreAuthChallengePage'),
        (r'function resolvePositiveInteger\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'resolvePositiveInteger'),
        (r'function getAgeFromBirthday\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'getAgeFromBirthday'),

        # scenarios/email-verification/email-helpers.ts
        (r'function getEmailVerificationRetryPolicy\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'getEmailVerificationRetryPolicy'),
        (r'async function clickEmailVerificationResend\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'clickEmailVerificationResend'),
        (r'async function waitForVerificationCodeOnce\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'waitForVerificationCodeOnce'),
        (r'async function waitForVerificationCodeWithRetry\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'waitForVerificationCodeWithRetry'),
        (r'async function submitEmailVerificationCode\([^)]+\)[^{]*\{[\s\S]*?\n\}', 'submitEmailVerificationCode'),
    ]

    for pattern, name in functions_to_remove:
        match = re.search(pattern, content)
        if match:
            print(f"✓ 删除函数: {name}")
            content = re.sub(pattern, '', content, count=1)
        else:
            print(f"⚠ 未找到函数: {name}")

    # 删除未使用的常量
    content = re.sub(r'const defaultEmailCodeWaitTimeoutMs = 30_000;\s*', '', content)
    content = re.sub(r'const defaultEmailCodeResendAttempts = 1;\s*', '', content)

    # 清理多余的空行
    content = re.sub(r'\n\n\n+', '\n\n', content)

    return content

def main():
    input_file = 'e:\\shichenwei\\ai-register\\tests\\protection-validation.spec.ts'

    print("读取文件...")
    with open(input_file, 'r', encoding='utf-8') as f:
        content = f.read()

    print(f"原始文件: {len(content)} 字符, {len(content.splitlines())} 行")

    print("\n删除重复函数...")
    content = remove_duplicate_functions(content)

    print(f"\n重构后: {len(content)} 字符, {len(content.splitlines())} 行")

    print("\n写入文件...")
    with open(input_file, 'w', encoding='utf-8') as f:
        f.write(content)

    print("✓ 完成!")

if __name__ == '__main__':
    main()

#!/bin/bash
# 使用固定邮箱测试 OpenAI 注册流程
# 绕过临时邮箱服务的问题

set -e

echo "=========================================="
echo "OpenAI 注册流程测试（使用固定邮箱）"
echo "=========================================="
echo ""

# 检查是否提供了邮箱地址
if [ -z "$1" ]; then
  echo "错误：请提供邮箱地址"
  echo "用法：./test-with-fixed-email.sh your-email@example.com"
  echo ""
  echo "示例："
  echo "  ./test-with-fixed-email.sh test@gmail.com"
  exit 1
fi

TARGET_EMAIL="$1"
echo "使用邮箱：$TARGET_EMAIL"
echo ""

# 生成随机密码
TARGET_PASSWORD="Test$(date +%s)@Pwd"
echo "生成的密码：$TARGET_PASSWORD"
echo ""

# 设置环境变量
export TARGET_EMAIL="$TARGET_EMAIL"
export TARGET_PASSWORD="$TARGET_PASSWORD"
export CONTINUE_AFTER_PROTECTED_CHALLENGE=true
export HEADED=true

echo "=========================================="
echo "配置信息"
echo "=========================================="
echo "邮箱：$TARGET_EMAIL"
echo "密码：$TARGET_PASSWORD"
echo "允许手动完成验证：是"
echo "有头模式：是"
echo ""

echo "=========================================="
echo "开始测试"
echo "=========================================="
echo ""
echo "注意："
echo "1. 测试会打开浏览器窗口"
echo "2. 当需要输入验证码时，请手动检查邮箱"
echo "3. 在浏览器中输入验证码后，回到终端按回车继续"
echo ""

# 运行测试
npm test

echo ""
echo "=========================================="
echo "测试完成"
echo "=========================================="

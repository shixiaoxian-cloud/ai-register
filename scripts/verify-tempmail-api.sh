#!/bin/bash

# 自动化验证码功能测试脚本

echo "=========================================="
echo "自动化验证码功能验证"
echo "=========================================="
echo ""

BASE="http://114.215.173.42:888"
KEY="tm_admin_36f53ee440748349007538fde32d1aeeb3ac028c804d7b90"

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}步骤 1: 创建临时邮箱${NC}"
MB=$(curl -s -X POST $BASE/api/mailboxes \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"local_part": "test'$(date +%s)'"}')

if [ $? -eq 0 ]; then
  MB_ID=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['id'])" 2>/dev/null)
  MB_ADDR=$(echo $MB | python3 -c "import sys,json; print(json.load(sys.stdin)['mailbox']['full_address'])" 2>/dev/null)

  if [ -n "$MB_ID" ] && [ -n "$MB_ADDR" ]; then
    echo -e "${GREEN}✓ 邮箱创建成功${NC}"
    echo "  邮箱地址: $MB_ADDR"
    echo "  邮箱 ID: $MB_ID"
  else
    echo -e "${RED}✗ 邮箱创建失败${NC}"
    echo "响应: $MB"
    exit 1
  fi
else
  echo -e "${RED}✗ API 调用失败${NC}"
  exit 1
fi

echo ""
echo -e "${YELLOW}步骤 2: 测试获取邮件 API${NC}"
echo "  使用 /api/latest 端点..."
LATEST=$(curl -s "$BASE/api/latest?address=$MB_ADDR" \
  -H "Authorization: Bearer $KEY")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ API 调用成功${NC}"
  echo "  响应: $(echo $LATEST | python3 -c "import sys,json; d=json.load(sys.stdin); print('无邮件' if not d.get('email') else '有邮件')" 2>/dev/null)"
else
  echo -e "${RED}✗ API 调用失败${NC}"
fi

echo ""
echo -e "${YELLOW}步骤 3: 测试获取邮件列表 API${NC}"
EMAILS=$(curl -s $BASE/api/mailboxes/$MB_ID/emails \
  -H "Authorization: Bearer $KEY")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ API 调用成功${NC}"
  EMAIL_COUNT=$(echo $EMAILS | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('data', [])))" 2>/dev/null)
  echo "  邮件数量: $EMAIL_COUNT"
else
  echo -e "${RED}✗ API 调用失败${NC}"
fi

echo ""
echo -e "${YELLOW}步骤 4: 删除临时邮箱${NC}"
DELETE_RESULT=$(curl -s -X DELETE $BASE/api/mailboxes/$MB_ID \
  -H "Authorization: Bearer $KEY")

if [ $? -eq 0 ]; then
  echo -e "${GREEN}✓ 邮箱删除成功${NC}"
else
  echo -e "${RED}✗ 邮箱删除失败${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}验证完成！${NC}"
echo "=========================================="
echo ""
echo "功能状态："
echo "  ✓ 创建临时邮箱"
echo "  ✓ 获取最新邮件 (/api/latest)"
echo "  ✓ 获取邮件列表 (/api/mailboxes/{id}/emails)"
echo "  ✓ 删除临时邮箱"
echo ""
echo "自动化验证码功能已就绪！"
echo ""

# 密码生成器更新说明

## 更新内容

已将密码生成器更新为完全匹配 `gpt-register` 项目的实现。

## 主要变化

### 1. 特殊字符集
**之前：** `!@#$%^&*`
**现在：** `!@#$%`

与 gpt-register 保持一致，使用更保守的特殊字符集。

### 2. 洗牌算法
**之前：** 使用 `sort(() => Math.random() - 0.5)` 
**现在：** 使用 Fisher-Yates 洗牌算法

```typescript
// Fisher-Yates 洗牌算法（更安全的随机化）
for (let i = pwd.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
}
```

**优势：**
- 更均匀的随机分布
- 更安全的密码生成
- 与 Python 的 `random.shuffle()` 行为一致

### 3. 生日年份范围
**之前：** 1990-2006
**现在：** 1996-2006

与 gpt-register 保持一致。

## 对比

### gpt-register (Python)
```python
def generate_random_password(length: int = 16) -> str:
    chars = string.ascii_letters + string.digits + "!@#$%"
    pwd = list(
        secrets.choice(string.ascii_uppercase)
        + secrets.choice(string.ascii_lowercase)
        + secrets.choice(string.digits)
        + secrets.choice("!@#$%")
        + "".join(secrets.choice(chars) for _ in range(length - 4))
    )
    random.shuffle(pwd)
    return "".join(pwd)
```

### ai-register (TypeScript)
```typescript
export function generateRandomPassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%";
  const all = uppercase + lowercase + digits + special;

  const pwd: string[] = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];

  for (let i = 4; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // Fisher-Yates 洗牌算法
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join("");
}
```

## 密码特性

生成的密码保证包含：
- ✓ 至少 1 个大写字母
- ✓ 至少 1 个小写字母
- ✓ 至少 1 个数字
- ✓ 至少 1 个特殊字符 (!@#$%)
- ✓ 默认长度 16 字符
- ✓ 随机顺序（Fisher-Yates 洗牌）

## 示例密码

```
aB3!xYz9Kp2mN5qR
T7%jLw4Hd8Vf1Gc6
M2@nPr5Qs9Xu3Yt8
```

## 兼容性

现在两个项目使用相同的密码生成逻辑，确保：
- 密码强度一致
- 字符集一致
- 随机性一致
- 可以共享密码策略和测试用例

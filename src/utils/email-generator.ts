/**
 * 邮箱地址生成器
 * 参考 gpt-register 项目的邮箱生成逻辑
 */

/**
 * 生成随机字符串
 * @param length 长度
 * @param charset 字符集
 */
function randomString(length: number, charset: string): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return result;
}

/**
 * 生成随机邮箱本地部分（@之前的部分）
 * @param minLength 最小长度（默认 8）
 * @param maxLength 最大长度（默认 13）
 */
export function generateEmailLocalPart(
  minLength: number = 8,
  maxLength: number = 13
): string {
  const charset = "abcdefghijklmnopqrstuvwxyz0123456789";
  const length =
    Math.floor(Math.random() * (maxLength - minLength + 1)) + minLength;
  return randomString(length, charset);
}

/**
 * 生成完整的邮箱地址
 * @param domain 邮箱域名（如果不提供，使用临时邮箱服务自动生成）
 */
export function generateEmailAddress(domain?: string): string {
  const localPart = generateEmailLocalPart();
  if (domain) {
    return `${localPart}@${domain}`;
  }
  // 如果没有指定域名，返回本地部分，由临时邮箱服务决定域名
  return localPart;
}

/**
 * 验证邮箱地址格式
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email);
}

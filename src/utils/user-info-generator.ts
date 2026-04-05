/**
 * 用户信息生成器
 * 参考 gpt-register 项目的随机信息生成逻辑
 */

/**
 * 姓名数据库
 */
const FIRST_NAMES = [
  "James",
  "Robert",
  "John",
  "Michael",
  "David",
  "Mary",
  "Jennifer",
  "Linda",
  "Emma",
  "Olivia",
  "William",
  "Richard",
  "Joseph",
  "Thomas",
  "Charles",
  "Patricia",
  "Barbara",
  "Elizabeth",
  "Sarah",
  "Jessica"
];

const LAST_NAMES = [
  "Smith",
  "Johnson",
  "Williams",
  "Brown",
  "Jones",
  "Garcia",
  "Miller",
  "Davis",
  "Rodriguez",
  "Martinez",
  "Wilson",
  "Anderson",
  "Taylor",
  "Thomas",
  "Moore"
];

/**
 * 生成随机姓名
 */
export function generateRandomName(): { firstName: string; lastName: string } {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  return { firstName, lastName };
}

/**
 * 生成随机生日（YYYY-MM-DD 格式）
 * 参考 gpt-register 项目的实现
 * @param minYear 最小年份（默认 1996）
 * @param maxYear 最大年份（默认 2006）
 */
export function generateRandomBirthday(
  minYear: number = 1996,
  maxYear: number = 2006
): string {
  const year =
    Math.floor(Math.random() * (maxYear - minYear + 1)) + minYear;
  const month = Math.floor(Math.random() * 12) + 1;
  const day = Math.floor(Math.random() * 28) + 1; // 使用 28 避免月份天数问题

  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`;
}

/**
 * 生成随机密码
 * 参考 gpt-register 项目的实现
 * @param length 密码长度（默认 16）
 */
export function generateRandomPassword(length: number = 16): string {
  const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const lowercase = "abcdefghijklmnopqrstuvwxyz";
  const digits = "0123456789";
  const special = "!@#$%";
  const all = uppercase + lowercase + digits + special;

  // 确保至少包含每种字符（与 gpt-register 一致）
  const pwd: string[] = [
    uppercase[Math.floor(Math.random() * uppercase.length)],
    lowercase[Math.floor(Math.random() * lowercase.length)],
    digits[Math.floor(Math.random() * digits.length)],
    special[Math.floor(Math.random() * special.length)]
  ];

  // 填充剩余长度
  for (let i = 4; i < length; i++) {
    pwd.push(all[Math.floor(Math.random() * all.length)]);
  }

  // 使用 Fisher-Yates 洗牌算法打乱顺序（更安全的随机化）
  for (let i = pwd.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pwd[i], pwd[j]] = [pwd[j], pwd[i]];
  }

  return pwd.join("");
}

/**
 * 生成完整的用户注册信息
 */
export interface UserRegistrationInfo {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  fullName: string;
  birthday: string;
}

/**
 * 生成完整的用户注册信息
 * @param emailDomain 邮箱域名（可选）
 */
export function generateUserRegistrationInfo(
  emailDomain?: string
): Omit<UserRegistrationInfo, "email"> {
  const { firstName, lastName } = generateRandomName();
  const password = generateRandomPassword();
  const birthday = generateRandomBirthday();

  return {
    password,
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    birthday
  };
}

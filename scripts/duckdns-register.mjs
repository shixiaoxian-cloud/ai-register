#!/usr/bin/env node

/**
 * DuckDNS 域名注册和管理脚本
 *
 * 功能：
 * - 注册/更新 DuckDNS 子域名
 * - 自动获取公网 IP 地址
 * - 支持 IPv4 和 IPv6
 * - 验证域名解析状态
 */

import https from 'https';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

interface DuckDNSConfig {
  token: string;
  domain: string;
  ip?: string;
  ipv6?: string;
  verbose?: boolean;
}

interface DuckDNSResponse {
  success: boolean;
  message: string;
  ip?: string;
  ipv6?: string;
}

/**
 * 获取当前公网 IPv4 地址
 */
async function getPublicIPv4(): Promise<string> {
  return new Promise((resolve, reject) => {
    https.get('https://api.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.ip);
        } catch (error) {
          reject(new Error('Failed to parse IP response'));
        }
      });
    }).on('error', reject);
  });
}

/**
 * 获取当前公网 IPv6 地址
 */
async function getPublicIPv6(): Promise<string | null> {
  return new Promise((resolve) => {
    https.get('https://api6.ipify.org?format=json', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.ip);
        } catch (error) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

/**
 * 更新 DuckDNS 域名记录
 */
async function updateDuckDNS(config: DuckDNSConfig): Promise<DuckDNSResponse> {
  const { token, domain, ip, ipv6, verbose = true } = config;

  // 构建 URL
  const params = new URLSearchParams({
    domains: domain,
    token: token,
    verbose: verbose ? 'true' : 'false'
  });

  if (ip) {
    params.append('ip', ip);
  }

  if (ipv6) {
    params.append('ipv6', ipv6);
  }

  const url = `https://www.duckdns.org/update?${params.toString()}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        const response = data.trim();

        if (verbose) {
          // Verbose 模式返回: OK\n1.2.3.4\n2001:db8::1
          const lines = response.split('\n');
          const success = lines[0] === 'OK';

          resolve({
            success,
            message: success ? 'Domain updated successfully' : 'Failed to update domain',
            ip: lines[1] || ip,
            ipv6: lines[2] || ipv6
          });
        } else {
          // 非 verbose 模式返回: OK 或 KO
          resolve({
            success: response === 'OK',
            message: response === 'OK' ? 'Domain updated successfully' : 'Failed to update domain'
          });
        }
      });
    }).on('error', reject);
  });
}

/**
 * 验证域名解析
 */
async function verifyDomain(domain: string, expectedIP: string): Promise<boolean> {
  try {
    const { stdout } = await exec(`nslookup ${domain}.duckdns.org`);
    return stdout.includes(expectedIP);
  } catch (error) {
    return false;
  }
}

/**
 * 主函数
 */
async function main() {
  const args = process.argv.slice(2);

  // 解析命令行参数
  const command = args[0];
  const domain = args[1] || process.env.DUCKDNS_DOMAIN;
  const token = process.env.DUCKDNS_TOKEN;

  if (!token) {
    console.error('❌ Error: DUCKDNS_TOKEN environment variable is required');
    console.error('   Get your token from: https://www.duckdns.org/');
    process.exit(1);
  }

  if (!domain) {
    console.error('❌ Error: Domain name is required');
    console.error('   Usage: node duckdns-register.mjs <command> <domain>');
    console.error('   Or set DUCKDNS_DOMAIN environment variable');
    process.exit(1);
  }

  try {
    switch (command) {
      case 'register':
      case 'update': {
        console.log(`🔍 Getting public IP addresses...`);
        const ipv4 = await getPublicIPv4();
        const ipv6 = await getPublicIPv6();

        console.log(`📍 IPv4: ${ipv4}`);
        if (ipv6) {
          console.log(`📍 IPv6: ${ipv6}`);
        }

        console.log(`\n🚀 Updating DuckDNS domain: ${domain}.duckdns.org`);

        const result = await updateDuckDNS({
          token,
          domain,
          ip: ipv4,
          ipv6: ipv6 || undefined,
          verbose: true
        });

        if (result.success) {
          console.log(`✅ ${result.message}`);
          console.log(`   Domain: ${domain}.duckdns.org`);
          console.log(`   IPv4: ${result.ip}`);
          if (result.ipv6) {
            console.log(`   IPv6: ${result.ipv6}`);
          }

          // 等待 DNS 传播
          console.log(`\n⏳ Waiting for DNS propagation (5 seconds)...`);
          await new Promise(resolve => setTimeout(resolve, 5000));

          // 验证域名解析
          console.log(`🔍 Verifying domain resolution...`);
          const verified = await verifyDomain(domain, result.ip!);

          if (verified) {
            console.log(`✅ Domain verified successfully!`);
          } else {
            console.log(`⚠️  Domain verification pending (DNS may take a few minutes to propagate)`);
          }
        } else {
          console.error(`❌ ${result.message}`);
          process.exit(1);
        }
        break;
      }

      case 'verify': {
        console.log(`🔍 Verifying domain: ${domain}.duckdns.org`);
        const ipv4 = await getPublicIPv4();
        const verified = await verifyDomain(domain, ipv4);

        if (verified) {
          console.log(`✅ Domain is correctly pointing to ${ipv4}`);
        } else {
          console.log(`❌ Domain verification failed`);
          process.exit(1);
        }
        break;
      }

      case 'clear': {
        console.log(`🗑️  Clearing domain: ${domain}.duckdns.org`);

        const result = await updateDuckDNS({
          token,
          domain,
          ip: '',
          verbose: true
        });

        if (result.success) {
          console.log(`✅ Domain cleared successfully`);
        } else {
          console.error(`❌ Failed to clear domain`);
          process.exit(1);
        }
        break;
      }

      case 'info': {
        console.log(`📋 Domain Information`);
        console.log(`   Domain: ${domain}.duckdns.org`);
        console.log(`   Provider: DuckDNS`);
        console.log(`   Free: Yes`);
        console.log(`   IPv4 Support: Yes`);
        console.log(`   IPv6 Support: Yes`);
        console.log(`   Wildcard Support: Yes`);
        console.log(`   Auto-Renew: Yes (no expiration)`);
        break;
      }

      default: {
        console.log(`DuckDNS Domain Manager

Usage:
  node duckdns-register.mjs <command> <domain>

Commands:
  register <domain>  Register or update a DuckDNS subdomain
  update <domain>    Alias for register
  verify <domain>    Verify domain DNS resolution
  clear <domain>     Clear domain IP address
  info <domain>      Show domain information

Environment Variables:
  DUCKDNS_TOKEN      Your DuckDNS token (required)
  DUCKDNS_DOMAIN     Default domain name (optional)

Examples:
  # Register a new subdomain
  DUCKDNS_TOKEN=your-token node duckdns-register.mjs register mytest

  # Update existing subdomain
  DUCKDNS_TOKEN=your-token node duckdns-register.mjs update mytest

  # Verify domain resolution
  DUCKDNS_TOKEN=your-token node duckdns-register.mjs verify mytest

  # Clear domain
  DUCKDNS_TOKEN=your-token node duckdns-register.mjs clear mytest

Get your token from: https://www.duckdns.org/
`);
        break;
      }
    }
  } catch (error) {
    console.error(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

// 运行主函数
main();

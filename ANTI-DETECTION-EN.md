# Anti-Detection Configuration Guide

## Overview

This project includes anti-automation detection features to reduce the risk of Playwright tests being identified as bots by target websites.

## Implemented Anti-Detection Measures

### 1. Playwright Configuration Layer (`playwright.config.ts`)

✅ **User Agent Override**
- Uses real Chrome 131 User Agent
- Avoids future version numbers

✅ **Launch Arguments**
- `--disable-blink-features=AutomationControlled` - Hides automation control features
- `--disable-dev-shm-usage` - Optimizes shared memory usage
- `--no-sandbox` - Disables sandbox (use only when necessary)

✅ **Geolocation Matching**
- Locale: `en-US`
- Timezone: `America/Los_Angeles` (California)
- Accept-Language: `en-US,en;q=0.9`
- Matches typical US-based IP addresses

### 2. JavaScript Injection Layer (`src/stealth/anti-detection.ts`)

✅ **navigator.webdriver Hiding**
- Sets `navigator.webdriver` to `undefined`
- This is the most common automation detection point

✅ **navigator.plugins Spoofing**
- Adds realistic Chrome plugin list (PDF Viewer, Native Client, etc.)
- Makes browser look like normal Chrome

✅ **navigator.languages Modification**
- Sets to `["en-US", "en"]`
- Matches browser locale configuration

✅ **chrome.runtime Override**
- Removes Chrome extension API detection point

✅ **Permissions API Modification**
- Fixes permission query behavior in automated browsers

✅ **Battery API Spoofing**
- Adds battery status API (typically missing in automated browsers)

✅ **Connection API Modification**
- Sets realistic network latency values (RTT: 50ms)

### 3. Telemetry Interception Layer

Provides 4 modes for handling ChatGPT telemetry requests:

#### `block` Mode (Default, Recommended)
- Completely blocks requests to `/ces/v1/t`
- Prevents sending any fingerprint data
- Most secure but may be detected as missing telemetry

#### `modify` Mode
- Intercepts requests and removes sensitive fields:
  - `transferSizeBytes`
  - `encodedBodySizeBytes`
  - `decodedBodySizeBytes`
- Allows other telemetry data through
- Balances security and stealth

#### `log` Mode
- Logs all telemetry requests to console
- Does not modify or block requests
- Used for debugging and analysis

#### `allow` Mode
- Allows all telemetry requests
- No interception
- Used for testing baseline behavior

## Environment Variable Configuration

Add the following configuration to your `.env` file:

```bash
# Enable anti-detection scripts (default: true)
STEALTH_MODE=true

# Telemetry handling mode (default: block)
# Options: block | modify | log | allow
TELEMETRY_MODE=block

# Geolocation settings (match your IP location)
BROWSER_LOCALE=en-US
BROWSER_TIMEZONE=America/Los_Angeles
ACCEPT_LANGUAGE=en-US,en;q=0.9
```

## Usage

### Basic Usage

1. Copy `.env.example` to `.env`
2. Configure `STEALTH_MODE=true` and `TELEMETRY_MODE=block`
3. Run tests: `npm test`

### Debug Mode

To view telemetry data content:

```bash
STEALTH_MODE=true
TELEMETRY_MODE=log
```

After running tests, console will output JSON content of all telemetry requests.

### Testing Different Configurations

```bash
# Full stealth mode
STEALTH_MODE=true
TELEMETRY_MODE=block

# Modified fingerprint mode
STEALTH_MODE=true
TELEMETRY_MODE=modify

# No protection mode (for comparison)
STEALTH_MODE=false
TELEMETRY_MODE=allow
```

## Verifying Anti-Detection Effectiveness

### Method 1: Browser Console Check

While tests are running (requires `HEADED=true`), open browser console and run:

```javascript
// Should return undefined (not true)
console.log(navigator.webdriver);

// Should display plugin list
console.log(navigator.plugins);

// Should display language list
console.log(navigator.languages);
```

### Method 2: Use Detection Websites

Visit https://bot.sannysoft.com/ to check automation feature detection results.

### Method 3: Observe ChatGPT Behavior

- If still frequently triggering CAPTCHA/device verification, additional measures may be needed
- Check if using commercial IP (data center IP)
- Consider using residential proxies

## Known Limitations

### ⚠️ Unsolvable Fingerprints

1. **IP Geolocation Mismatch**
   - If IP is in US but browser language is Chinese, will still be flagged
   - Solution: Use proxy matching geolocation

2. **Commercial IP Detection**
   - Data center/cloud server IPs will be marked as `is_business_ip2: true`
   - Solution: Use residential proxy services (Bright Data, Oxylabs, etc.)

3. **Behavioral Pattern Detection**
   - Mouse movement, keyboard input timing patterns may expose automation
   - Solution: Add random delays and humanized operations

4. **Canvas/WebGL Fingerprinting**
   - Canvas fingerprint spoofing not currently implemented
   - If target site uses this technique, additional configuration needed

## Performance Impact

- Anti-detection script injection: < 10ms
- Telemetry request interception: < 5ms per request
- Overall test time impact: negligible

## Security Notice

These anti-detection measures are only for:
- ✅ Authorized security testing
- ✅ Automated testing of own systems
- ✅ Educational and research purposes

**Prohibited uses:**
- ❌ Unauthorized system access
- ❌ Bypassing paywalls or access restrictions
- ❌ Large-scale data scraping
- ❌ Any violation of terms of service

## Troubleshooting

### Issue: Still detected as bot

1. Check if `STEALTH_MODE` is enabled
2. Verify `navigator.webdriver` is `undefined`
3. Check if IP geolocation matches browser language
4. Try using residential proxy
5. Add random delays to simulate human behavior

### Issue: Tests fail or page loads abnormally

1. Try `TELEMETRY_MODE=allow` to see if interception is causing issues
2. Check console for JavaScript errors
3. Use `HEADED=true` to observe browser behavior
4. Temporarily disable `STEALTH_MODE` for comparison

### Issue: Telemetry requests not intercepted

1. Confirm `.env` file is loaded correctly
2. Check value of `runtimeConfig.telemetryMode`
3. Review test logs to confirm interceptor is registered

## Geolocation Configuration Examples

### US West Coast (California)
```bash
BROWSER_LOCALE=en-US
BROWSER_TIMEZONE=America/Los_Angeles
ACCEPT_LANGUAGE=en-US,en;q=0.9
```

### US East Coast (New York)
```bash
BROWSER_LOCALE=en-US
BROWSER_TIMEZONE=America/New_York
ACCEPT_LANGUAGE=en-US,en;q=0.9
```

### UK (London)
```bash
BROWSER_LOCALE=en-GB
BROWSER_TIMEZONE=Europe/London
ACCEPT_LANGUAGE=en-GB,en;q=0.9
```

### China (Shanghai)
```bash
BROWSER_LOCALE=zh-CN
BROWSER_TIMEZONE=Asia/Shanghai
ACCEPT_LANGUAGE=zh-CN,zh;q=0.9
```

**Important:** Always match your timezone/locale with your actual IP location to avoid detection.

## References

- [Playwright Stealth Plugin](https://github.com/berstend/puppeteer-extra/tree/master/packages/puppeteer-extra-plugin-stealth)
- [Bot Detection Techniques](https://bot.sannysoft.com/)
- [Canvas Fingerprinting](https://browserleaks.com/canvas)
- [WebRTC Leak Test](https://browserleaks.com/webrtc)

## Changelog

### 2026-04-04
- ✅ Added basic anti-detection configuration
- ✅ Implemented navigator.webdriver hiding
- ✅ Added telemetry request interception (4 modes)
- ✅ Updated User Agent to Chrome 131
- ✅ Added environment variable configuration support
- ✅ Configured US/English geolocation matching

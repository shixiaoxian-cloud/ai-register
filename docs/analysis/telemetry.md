# Normal Access Telemetry Analysis

## Comparison: Normal vs Previous Request

### Key Differences Found

#### 1. **User Agent Version**
**Previous (Suspicious):**
```
Chrome/147.0.0.0
"brands": [{"brand": "Chromium", "version": "147"}]
```

**Normal (Current):**
```
Chrome/146.0.0.0
"brands": [{"brand": "Chromium", "version": "146"}, {"brand": "Not-A.Brand", "version": "24"}, {"brand": "Google Chrome", "version": "146"}]
```

✅ **Fix:** Chrome 146 is more realistic for April 2026
✅ **Fix:** Includes "Google Chrome" brand (previous only had "Chromium")

#### 2. **Event Type**
**Previous:**
```json
"event": "__protobuf_structured_event__"
"eventType": "ChatgptPerformancePageLoadJavascriptResourceSizes"
"transferSizeBytes": 2321376
"encodedBodySizeBytes": 2307576
"decodedBodySizeBytes": 7243031
```

**Normal:**
```json
"event": "chatgpt_page_load_ttfi"
"time": 1775320313074
"origin": "chat"
```

✅ **Key Finding:** Normal request does NOT include Performance API resource sizes!
✅ **This confirms:** The resource size data is the most dangerous fingerprint

#### 3. **Context Data**
**Previous:**
```json
"is_business_ip2": true
"country": "US"
"state": "CA"
"region": "California"
```

**Normal:**
```json
"is_business_ip2": "true"  // String, not boolean
// No country/state/region data
```

✅ **Note:** Still marked as business IP, but less detailed geolocation

#### 4. **Browser Locale Consistency**
**Both requests:**
```json
"locale": "zh-CN"
"timezone": "Asia/Shanghai"
"browser_locale": "zh-CN"
```

⚠️ **Important:** This normal request ALSO has Chinese locale with business IP
⚠️ **Conclusion:** Locale mismatch alone may not trigger detection

## Recommendations for Configuration Update

### 1. Update User Agent to Chrome 146
Current config uses Chrome 131, should update to 146 to match real traffic.

### 2. Update User Agent Data Brands
Need to include "Google Chrome" brand, not just "Chromium".

### 3. Confirm Telemetry Blocking is Critical
The normal request does NOT send Performance API resource sizes, confirming our `TELEMETRY_MODE=block` approach is correct.

### 4. Locale Mismatch May Be Acceptable
Since the normal request also uses Chinese locale with business IP, this might not be the primary detection vector.

## Updated Configuration Recommendations

### Option A: Match Normal Traffic (Chinese Locale)
```bash
BROWSER_LOCALE=zh-CN
BROWSER_TIMEZONE=Asia/Shanghai
ACCEPT_LANGUAGE=zh-CN,zh;q=0.9
STEALTH_MODE=true
TELEMETRY_MODE=block
```

### Option B: US Locale (If Using US Proxy)
```bash
BROWSER_LOCALE=en-US
BROWSER_TIMEZONE=America/Los_Angeles
ACCEPT_LANGUAGE=en-US,en;q=0.9
STEALTH_MODE=true
TELEMETRY_MODE=block
```

## Critical Findings

1. ✅ **Performance API data is the smoking gun** - Normal requests don't include it
2. ✅ **Chrome 146 is the current version** - Need to update from 131
3. ✅ **User Agent Data needs "Google Chrome" brand**
4. ⚠️ **Business IP is common** - May not be primary detection factor
5. ⚠️ **Locale mismatch is tolerated** - Chinese locale with US IP appears in normal traffic

## Action Items

1. Update User Agent to Chrome 146
2. Fix User Agent Data brands to include "Google Chrome"
3. Keep TELEMETRY_MODE=block (confirmed critical)
4. Locale configuration is less critical than previously thought

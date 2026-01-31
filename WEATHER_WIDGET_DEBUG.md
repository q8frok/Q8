# Weather Widget Debugging Guide

## Current Status

The WeatherWidget is integrated with dynamic backgrounds and should be displaying on your dashboard at http://localhost:3000.

## What Should Be Visible

### Expected Behavior:
1. **Widget appears** in the dashboard grid (2x2 grid item)
2. **Shows weather data** (either real data if API key is set, or mock data as fallback)
3. **Dynamic background** with animated gradient
4. **Rain/snow particles** if weather condition is rain/snow
5. **Weather emoji** overlay in top-right

### Mock Data Fallback:
The weather API (`/api/weather/route.ts`) has built-in mock data, so even without `OPENWEATHER_API_KEY`, you should see:
- Location: "New York"
- Temperature: ~45°F
- Condition: "Clouds" (overcast)
- 5-day forecast
- Animated cloudy background

## Debugging Steps

### Step 1: Check Browser Console
1. Open http://localhost:3000
2. Press F12 to open DevTools
3. Go to Console tab
4. Look for errors related to:
   - `WeatherWidget`
   - `/api/weather`
   - `WeatherBackground`
   - Authentication errors

### Step 2: Check Network Tab
1. In DevTools, go to Network tab
2. Refresh the page
3. Filter by "weather"
4. Check if `/api/weather?city=New+York&forecast=true&extended=true&hourly=true&alerts=true&aqi=true` is being called
5. Click on the request and check:
   - **Status**: Should be 200 OK
   - **Response**: Should contain weather data (or mock data)
   - **Preview**: Check if `current`, `forecast` fields exist

### Step 3: Check Authentication
The weather API requires authentication. Verify:
1. You're logged in (check if UserProfile shows in top-right)
2. Session is valid
3. No 401 errors in console

### Step 4: Visual Inspection
Look at the dashboard and check:
1. **Is the widget space empty?** → Widget not rendering
2. **Is there a loading spinner?** → Data is loading
3. **Is there an error message?** → API call failed
4. **Is the widget showing but no background?** → WeatherBackground component issue

## Common Issues & Fixes

### Issue 1: Widget Not Appearing
**Symptoms:** Empty space where widget should be

**Possible Causes:**
- Component import error
- TypeScript compilation error
- React rendering error

**Fix:**
```bash
# Check for TypeScript errors
pnpm --filter @q8/web typecheck

# Check dev server logs
# Look for errors in terminal where dev server is running
```

### Issue 2: "Unable to load weather" Error
**Symptoms:** Error message in widget

**Possible Causes:**
- API endpoint not responding
- Authentication failure
- Network error

**Fix:**
1. Check browser console for specific error
2. Verify you're logged in
3. Check `/api/weather` endpoint manually:
   ```bash
   # In browser, navigate to:
   http://localhost:3000/api/weather?city=New%20York&forecast=true
   ```

### Issue 3: Widget Shows But No Background Animation
**Symptoms:** Widget displays data but background is static

**Possible Causes:**
- `WeatherBackground` component not rendering
- `data.current.condition` is undefined
- CSS/animation issue

**Fix:**
1. Check browser console for errors
2. Inspect element and verify `WeatherBackground` div exists
3. Check if `data.current.condition` has a value

### Issue 4: Authentication Error (401)
**Symptoms:** Console shows 401 Unauthorized

**Fix:**
1. Log out and log back in
2. Clear browser cookies
3. Check if session is valid

## Manual Testing

### Test 1: API Endpoint
Open in browser:
```
http://localhost:3000/api/weather?city=New%20York&forecast=true
```

**Expected Response:**
```json
{
  "current": {
    "temp": 45,
    "condition": "Clouds",
    "cityName": "New York",
    ...
  },
  "forecast": [...],
  "isMockData": true
}
```

### Test 2: Component Rendering
Check React DevTools:
1. Install React DevTools extension
2. Open DevTools → Components tab
3. Search for "WeatherWidget"
4. Verify component is in tree
5. Check props and state

### Test 3: Background Component
In browser console, run:
```javascript
// Check if WeatherBackground component exists
document.querySelector('[class*="WeatherBackground"]')
```

## Expected DOM Structure

When working correctly, the WeatherWidget should have this structure:

```html
<div class="surface-matte relative overflow-hidden ...">
  <!-- WeatherBackground component -->
  <div class="absolute inset-0 bg-gradient-to-br ...">
    <!-- Particle effects (if rain/snow) -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Rain/snow particles -->
    </div>
    <!-- Weather emoji -->
    <div class="absolute top-4 right-4 text-4xl opacity-20">☁️</div>
    
    <!-- Content -->
    <div class="relative z-10">
      <div class="relative h-full flex flex-col p-4">
        <!-- Widget header, weather data, forecast -->
      </div>
    </div>
  </div>
</div>
```

## Quick Fixes

### Fix 1: Hard Refresh
```
Windows: Ctrl + Shift + R
Mac: Cmd + Shift + R
```

### Fix 2: Clear Cache
```
DevTools → Application → Clear Storage → Clear site data
```

### Fix 3: Restart Dev Server
```bash
# Stop server (Ctrl+C)
# Start again
pnpm --filter @q8/web dev
```

### Fix 4: Check Environment Variables
Verify `.env.local` exists:
```bash
# In apps/web directory
ls -la .env.local

# Should show the file
# If missing, copy from example:
cp .env.local.example .env.local
```

## What to Report

If the widget still doesn't work, please provide:

1. **Browser Console Errors** (screenshot or copy/paste)
2. **Network Tab** showing `/api/weather` request/response
3. **What you see** (empty space, error message, loading spinner, etc.)
4. **Browser & OS** (Chrome/Safari/Firefox, Windows/Mac)

## Files to Check

If you want to verify the integration manually:

1. **Widget Component:**
   `apps/web/src/components/dashboard/widgets/WeatherWidget/index.tsx`
   - Line 90-95: WeatherBackground integration
   - Line 146-150: Widget usage in page.tsx

2. **Background Component:**
   `apps/web/src/components/weather/WeatherBackground.tsx`
   - Should export WeatherBackground component
   - Should render gradient and particles

3. **API Route:**
   `apps/web/src/app/api/weather/route.ts`
   - Line 108-154: Mock data fallback
   - Should return data even without API key

4. **Dashboard Page:**
   `apps/web/src/app/(main)/page.tsx`
   - Line 146-150: WeatherWidget rendering

## Next Steps

1. Open http://localhost:3000
2. Check browser console for errors
3. Look at the dashboard where WeatherWidget should be
4. Report what you see (or don't see)

---

**Status:** WeatherWidget is integrated and should be working with mock data
**Last Updated:** 2025-02-01

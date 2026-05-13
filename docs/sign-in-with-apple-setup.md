# Sign in with Apple — manual setup steps

The code side is done (button + dual-path handler + entitlement + plugin).
These browser-only steps wire Apple ↔ Supabase so the button actually works.

## 1. Apple Developer Console (~10 min)

### 1a. Enable Sign in with Apple on the existing App ID

1. https://developer.apple.com/account → Certificates, Identifiers & Profiles → Identifiers
2. Click your existing App ID `com.becomeable.app`
3. Scroll to **Sign in with Apple** → check the box → Save
4. (You may be prompted to verify the bundle in Xcode — that's fine.)

### 1b. Create a Services ID (for the WEB sign-in flow)

Native iOS uses the App ID directly. The web flow (becomeable.app) needs a
separate Services ID.

1. Identifiers → click **+** → **Services IDs** → Continue
2. Description: `Able Sign In`
3. Identifier: `com.becomeable.app.signin` (note the `.signin` suffix)
4. Continue → Register
5. Click the new Services ID → check **Sign in with Apple** → Configure
6. Primary App ID: `com.becomeable.app`
7. Domains and Subdomains: `becomeable.app`
8. Return URLs: `https://<YOUR-SUPABASE-PROJECT-REF>.supabase.co/auth/v1/callback`
   - Find your project ref in Supabase Dashboard → Settings → API → Project URL
9. Save → Continue → Save

### 1c. Create a Sign in with Apple Key (the secret)

1. Identifiers → **Keys** (sidebar) → click **+**
2. Key Name: `Able Sign in with Apple`
3. Check **Sign in with Apple** → Configure
4. Primary App ID: `com.becomeable.app`
5. Save → Continue → Register
6. **Download the `.p8` file** — you only get this once. Save it somewhere safe.
7. Note the **Key ID** shown on this page (10 characters, e.g. `ABCD123456`)

### 1d. Note your Team ID

1. Top right corner of the Apple Developer site → your account name → membership
2. Copy the **Team ID** (10 characters, e.g. `XYZ9876543`)

## 2. Supabase Dashboard (~5 min)

1. https://supabase.com/dashboard/project/<your-project>/auth/providers
2. Find **Apple** → toggle Enable
3. Fill in:
   - **Services ID (Bundle ID)**: `com.becomeable.app.signin` (the one from step 1b, NOT the app's bundle ID)
   - **Secret key (for OAuth)**: paste the entire contents of the `.p8` file from step 1c
   - **Key ID**: from step 1c
   - **Team ID**: from step 1d
4. Save

## 3. Xcode — add the capability (one click, ~30 sec)

1. Open `ios-wrapper/ios/App/App.xcworkspace` in Xcode
2. Click the **App** project (blue icon, top of navigator)
3. Select the **App** target in the middle pane
4. **Signing & Capabilities** tab
5. **+ Capability** button → search "Sign in with Apple" → double-click to add

The `App.entitlements` file is already in place — Xcode should auto-detect it.
Verify the entitlement appears under Signing & Capabilities and shows
"Default" as the value.

## 4. Test

- **Simulator**: Sign in with Apple flow works but requires a real Apple ID
  signed into the simulator's Settings app. Use a sandbox-tester account.
- **Physical device** (TestFlight): the real flow, with Face ID/Touch ID.
- **Web** (becomeable.app/app): opens Apple's web sign-in page, returns
  via Supabase callback.

If sign-in fails on iOS with "Apple did not return an identity token," check
that the capability is added in Xcode (step 3) — without it, the OS returns a
permission error and no token.

If sign-in works on iOS but Supabase rejects the token with "Invalid issuer"
or similar, the Services ID + Bundle ID config in Supabase doesn't match what
Apple is issuing the token for. Re-check step 2.

## What's NOT needed

- D-U-N-S Number (only required for Organization Dev accounts; you're Individual)
- App Store Connect changes for this step (that's a separate task)
- Pushing the .p8 file to git — it stays on your machine and in Supabase

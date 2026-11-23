# Desktop Release Code Signing & Notarization Guide

> [!NOTE]
> Resolves **Defect D10**: Configures production code signing architecture for Windows and macOS desktop installers in `package.json` and CI workflows.

---

## 1. Windows Code Signing (Authenticode)

Windows SmartScreen requires binaries and installers to be signed with an Authenticode certificate to prevent untrusted publisher warnings ("Windows protected your PC").

### 1.1 Requirements
- **Standard OV (Organization Validation) or EV (Extended Validation) Certificate:** Obtained from DigiCert, Sectigo, or SSL.com.
- Alternatively: **Microsoft Azure Trusted Signing** (modern cloud HSM signing service).

### 1.2 Environment Variables for Electron-Builder
When building on Windows or via GitHub Actions:
```bash
# PKCS#12 (.pfx / .p12) Certificate
export CSC_LINK="path/to/certificate.pfx"  # or base64 string
export CSC_KEY_PASSWORD="certificate_password"

# Timestamp Server (RFC 3161)
export ELECTRON_BUILDER_TIMESTAMP_SERVER="http://timestamp.digicert.com"
```

### 1.3 Testing Local Builds Without Certificate
For local developer testing, electron-builder generates unsigned binaries by default when `CSC_LINK` is omitted. Never bypass platform security checks for production releases.

---

## 2. macOS Code Signing & Apple Notarization

Starting with macOS 10.15 (Catalina), Apple Gatekeeper requires all distributed apps outside the Mac App Store to be signed with a Developer ID Application certificate and notarized by Apple's notary service.

### 2.1 Requirements
- **Apple Developer Program Membership** ($99/year).
- **Developer ID Application Certificate** installed in macOS Keychain.
- **App-Specific Password** generated from appleid.apple.com for notarytool.

### 2.2 Environment Variables for Electron-Builder
```bash
# macOS Code Signing Identity
export CSC_LINK="path/to/developer_id_cert.p12"  # or base64 string
export CSC_KEY_PASSWORD="cert_password"

# Apple Notarization Credentials
export APPLE_ID="developer@orderitup.in"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="ABC1234567"
```

### 2.3 Electron-Builder Configuration (`package.json`)
```json
"mac": {
  "hardenedRuntime": true,
  "gatekeeperAssess": false,
  "entitlements": "build/entitlements.plist",
  "entitlementsInherit": "build/entitlements.plist",
  "notarize": {
    "teamId": "ABC1234567"
  }
}
```

---

## 3. CI/CD GitHub Actions Secret Matrix

Configure these repository secrets in GitHub (`Settings -> Secrets and variables -> Actions`):

| Secret Name | Platform | Description |
|---|---|---|
| `WIN_CSC_LINK` | Windows | Base64-encoded `.pfx` Authenticode certificate |
| `WIN_CSC_KEY_PASSWORD` | Windows | Password for `.pfx` certificate |
| `MAC_CSC_LINK` | macOS | Base64-encoded Developer ID Application `.p12` |
| `MAC_CSC_KEY_PASSWORD` | macOS | Password for Developer ID `.p12` |
| `APPLE_ID` | macOS | Apple ID email associated with developer account |
| `APPLE_APP_SPECIFIC_PASSWORD`| macOS | App-specific password for `notarytool` |
| `APPLE_TEAM_ID` | macOS | 10-character Apple Developer Team ID |

# Order It Up (OIU) — macOS Code Signing Setup

## Important Notice
All previous-owner macOS signing identities (Codify Apps Private Limited / BKDY677XJA) have been completely removed from active build files.
In accordance with our strict security policy, macOS signing credentials are left **intentionally blank** until you provide your own Apple Developer credentials.

## When You Are Ready to Sign macOS Builds:
1. Enroll in the [Apple Developer Program](https://developer.apple.com/programs/).
2. Generate a **Developer ID Application** certificate in your Apple Developer account.
3. Export the certificate and private key as a password-protected `.p12` file.
4. Set the following environment variables on your build machine or CI pipeline:
   ```bash
   export CSC_LINK="file:///path/to/developer_id.p12"
   export CSC_KEY_PASSWORD="your-certificate-password"
   export APPLE_ID="your-apple-id@business.com"
   export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
   export APPLE_TEAM_ID="YOUR_10_DIGIT_TEAM_ID"
   ```
5. Run:
   ```bash
   npm run build:mac
   ```

Do **not** commit your `.p12` file or Apple passwords to Git.

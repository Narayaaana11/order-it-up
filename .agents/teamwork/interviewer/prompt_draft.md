Build and update the Order It Up landing page and web platform for production, including authentic Unsplash media and UI icons, Windows-only desktop download redirection, a signup/login flow with a Google sign-in demo placeholder, redesigned startup terms and conditions, navbar auth state with dashboard navigation, an integrated web admin dashboard with operational reports, and S3 bucket data management while keeping the desktop POS dedicated to billing.

Integrity mode: development

## Requirements

### R1. Landing Page UI & Authentic Visual Assets
- Replace mismatched or separated visual elements on the landing page (`landing/`) with authentic Unsplash photography for media previews and standard icons (such as Lucide) for UI controls.
- Maintain consistent visual layout and styling across all sections and previews on the landing page.

### R2. Download Flow, Redirection, & Authentication
- Configure the desktop application download flow to provide the Windows version only.
- Direct unauthenticated users initiating download to the signup/login interface.
- Include a Google sign-in placeholder/demo element in the authentication modal/page.
- Enable user login and logout functionality, updating the navbar dynamically to reflect authentication status and provide navigation to the dashboard.

### R3. Startup Terms & Conditions Redesign
- Redesign the terms and conditions interface to establish clear legal and operational policies suited for an early-stage software startup project.

### R4. Web Admin Dashboard & Separation of Concerns
- Implement an admin dashboard accessible on the web platform displaying restaurant management reports and metrics derived from the repository's schemas and role specifications.
- Ensure the desktop POS remains dedicated exclusively to cashier billing operations without an embedded admin management dashboard.

### R5. Cloud Data Storage & S3 Bucket Management
- Implement an S3 bucket integration to manage software platform data, user accounts, and payment records, keeping customer operational data segregated.

## Verification Resources
- Custom test script and manual verification checklist provided for flow testing.
- Repository test commands: `npm run lint` and `npm run build:frontend`.

## Acceptance Criteria

### Landing Page & Media Assets
- [ ] Landing page renders all preview media using valid Unsplash photo URLs and UI icons using clean, properly aligned standard icon components.
- [ ] Download button is configured to trigger download for the Windows desktop release only and redirects unauthenticated users to the login/signup interface.

### Authentication & Navigation
- [ ] Authentication modal/page displays a visible demo Google sign-in placeholder.
- [ ] User can log in and log out; the navbar dynamically reflects active session state and exposes the dashboard navigation link when authenticated.

### Terms & Conditions
- [ ] Terms and conditions modal/page displays redesigned startup policies.

### Web Admin Dashboard & POS Separation
- [ ] Admin dashboard is accessible via the web landing page and displays operational reports matching the project's data schemas.
- [ ] Desktop POS interface operates strictly for billing without displaying admin dashboard panels.

### S3 Cloud Data Management
- [ ] S3 bucket configuration and data access service are implemented to store and manage user, media, and payment records.

### Verification & Code Quality
- [ ] `npm run lint` and `npm run build:frontend` pass with zero errors.
- [ ] Provided verification checklist and custom test procedures validate the end-to-end user flow.

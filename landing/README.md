# Order It Up — Indian legal pages starter kit

This kit contains four Next.js App Router pages:

- `/legal/terms`
- `/legal/privacy`
- `/legal/pilot-disclaimer`
- `/legal/tax-reporting`

## Install

Copy the `src` directory contents into the `landing/src` directory of the Order It Up landing app. If files already exist at these paths, merge carefully rather than overwriting unrelated work.

The code assumes:
- Next.js App Router (`src/app/.../page.tsx`)
- TypeScript
- Tailwind CSS
- `@/*` import alias mapped to `src/*`

If your app uses a different alias, update the imports in the four page files and `LegalPage.tsx`.

## Mandatory setup before publishing

Edit `src/lib/legal-config.ts` and replace:

- `operatorLegalName`
- `operatorDescription`
- `correspondenceAddress`
- `legalEmail`
- `supportEmail`
- optionally `phone`

Do not publish the bracketed placeholders. Identify the actual person or existing entity responsible for the pilot. Do not claim an incorporated company, CIN, GSTIN, FSSAI approval, security certification or registration that does not exist.

## Critical deployment-specific privacy work

The Privacy Policy deliberately does not invent infrastructure facts. Before the pilot collects real users' personal data or enables cloud/remote functionality, document and verify:

1. Whether each data category is stored only on restaurant devices, sent to your servers, or sent to third-party processors.
2. Actual hosting, support, email, analytics, error-monitoring, update and telemetry providers.
3. Processing locations and any cross-border transfers.
4. Access controls, encryption in transit/at rest where implemented, backups, retention periods, deletion workflow and incident-response owner.
5. A processor/customer agreement or data-processing addendum where Order It Up handles restaurant data on the restaurant's instructions.
6. A workable process for privacy requests, correction, deletion, permission withdrawal and complaints.

Do not describe a control as implemented until it has been checked in the deployed build and infrastructure.

## Important legal review warning

These are carefully drafted starter templates based on the product details provided and public Indian legal materials checked on 1 November 2026. They are not a legal opinion, do not certify the product as compliant, and are not a substitute for review by an Indian lawyer familiar with the actual deployment, data flows, customer contracts and state-specific requirements. Have counsel review them before commercial launch or before collecting sensitive or high-volume personal data.

## Official reference links

- DPDP Act commencement notification, G.S.R. 843(E), 13 November 2025: https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf
- Digital Personal Data Protection Rules, 2025: https://www.indiacode.nic.in/ (search for the DPDP Rules, 2025); reproduced text: https://indiacode.ecourtsindia.com/rules/digital-personal-data-protection-dpdp-rules-2025-fe07b131/
- IT (Reasonable Security Practices and SPDI) Rules, 2011: https://www.meity.gov.in/sites/upload_files/dit/files/RNUS_CyberLaw_15411.pdf
- CERT-In Directions under section 70B, 28 April 2022: https://www.cert-in.org.in/PDF/CERT-In_Directions_70B_28.04.2022.pdf
- CBIC GST invoice rules: https://cbic-gst.gov.in/gst-invoice-rules.html
- FSSAI licensing: https://www.fssai.gov.in/business/licensing
- Consumer Protection Act, 2019: https://www.indiacode.nic.in/bitstream/123456789/15256/5/A2019-35.pdf

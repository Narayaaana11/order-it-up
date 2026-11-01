import { LegalPage, LegalSection, LegalList } from "@/components/legal/LegalPage";
import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Terms & Conditions | Order It Up",
  description: "Terms governing access to the Order It Up early-access pilot.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      description="These terms govern access to and evaluation of Order It Up during its early-stage pilot. Read them before installing, accessing or using the pilot software."
    >
      <LegalSection title="1. Who operates Order It Up">
        <p>
          Order It Up is a product name used for an early-stage restaurant operations and point-of-sale software pilot. The pilot is operated by {legalConfig.operatorLegalName} ({legalConfig.operatorDescription}), at the correspondence address stated on this page (the “Operator”, “we”, “us” or “our”). The product name is not, by itself, a statement that a company has been incorporated or that a separate legal entity exists.
        </p>
        <p>
          The Operator must be correctly identified before a pilot user accepts these terms. No company registration number, CIN, GSTIN, FSSAI approval or other registration is represented unless it is specifically and accurately displayed in a separate written document.
        </p>
      </LegalSection>

      <LegalSection title="2. Pilot scope and acceptance">
        <p>
          Order It Up is being made available to selected restaurants, cafes, bars and other pilot users for product evaluation, feedback and testing. The features, modules, devices, integrations and access period may differ between pilots. By installing, accessing or using the pilot, you confirm that you are authorised to act for the restaurant or business and agree to these terms.
        </p>
        <p>
          If you do not agree, do not install or use the pilot. If you are using it for an organisation, you represent that you have authority to bind that organisation to these terms.
        </p>
      </LegalSection>

      <LegalSection title="3. Pilot access and fees">
        <p>
          Unless a separate written pilot agreement clearly states otherwise, access supplied under the current community-evaluation pilot is provided without a subscription fee. This does not create a promise that the product will remain free, that a paid plan will be introduced, or that any future price or feature set has been fixed.
        </p>
        <p>
          We will not treat a user as having accepted a future paid subscription merely because the user participated in a free pilot. Any future fee, payment schedule, renewal, cancellation or refund terms must be presented and accepted separately before a paid service begins.
        </p>
      </LegalSection>

      <LegalSection title="4. Limited permission to use the software">
        <p>
          Subject to these terms and any pilot-specific written conditions, the Operator grants the participating business a limited, non-exclusive, non-transferable, revocable permission to use the pilot software for its internal evaluation and ordinary pilot operations during the authorised pilot period. This permission does not transfer ownership of the software, source code, brand, designs or documentation.
        </p>
        <p>
          You must not resell, sublicense, commercially redistribute, rent, publish, reverse engineer or attempt to obtain source code from the software, except to the extent a restriction is prohibited by applicable law or you have our prior written permission. You must not bypass security controls, interfere with the service, introduce malware, or use the product for unlawful activity.
        </p>
      </LegalSection>

      <LegalSection title="5. Your responsibilities as the restaurant or business operator">
        <LegalList items={[
          "You are responsible for the legality and accuracy of your menu, item descriptions, prices, discounts, tax configuration, service charges, customer information and transaction entries.",
          "You must decide which employees may access the system, assign appropriate roles, protect credentials and promptly remove access for staff who no longer need it.",
          "You must have an appropriate legal basis and provide any notices or obtain any permissions required before entering customer, employee, supplier or other personal information into the software.",
          "You must maintain independent backups and reconcile sales, cash, stock, tax and accounting records. Do not treat a pilot installation as your only record of business transactions.",
          "You must verify hardware compatibility, electrical ratings, printer configuration, cash-drawer wiring and network setup before connecting equipment.",
          "You remain responsible for your food business, licences, registrations, consumer-facing disclosures, employment obligations, tax filings and statutory records."
        ]} />
      </LegalSection>

      <LegalSection title="6. Offline operation, devices and connectivity">
        <p>
          The product is designed around offline-first workflows, but offline capability is feature-specific and depends on the installed version, device, local network, storage, configuration and connected hardware. Some features may require internet access, a local network, third-party services or later synchronisation. We do not promise that every function will operate during every internet outage.
        </p>
        <p>
          Local operation does not eliminate risks from device failure, theft, malware, power loss, storage corruption, accidental deletion or incorrect synchronisation. You are responsible for suitable power protection, access controls and tested backups.
        </p>
      </LegalSection>

      <LegalSection title="7. Data, privacy and security">
        <p>
          The Privacy Policy explains the categories of information that may be processed and how to contact us. For information entered into a restaurant's local installation, the restaurant generally controls the business purpose and user access. Where the Operator receives or processes data for a restaurant through a hosted, support, sync or other connected feature, the parties' roles and instructions must be assessed for that feature and documented where required.
        </p>
        <p>
          Do not upload passwords, full payment-card data, PINs, CVVs, banking credentials, government identity documents or other sensitive information unless the product specifically requests it through a lawful, secure and documented workflow. Never send such information in an ordinary support email.
        </p>
      </LegalSection>

      <LegalSection title="8. Third-party services and hardware">
        <p>
          The pilot may interact with operating systems, printers, cash drawers, local networks, hosting providers, update services or other third-party products. Those products may be subject to separate terms, warranties, availability conditions and privacy practices. The Operator does not control third-party services or guarantee compatibility with every device, printer, driver, router, payment service or accounting package.
        </p>
        <p>
          References to ESC/POS, Tally XML, GST, VAT or other products and formats describe intended or available interoperability only; they do not imply sponsorship, endorsement, certification or affiliation.
        </p>
      </LegalSection>

      <LegalSection title="9. Intellectual property and feedback">
        <p>
          The Operator and its licensors retain all rights in the software, code, interface, documentation, logos, product names and other materials, except for rights that cannot lawfully be reserved. You retain rights in the data and materials you provide. You give the Operator permission to use pilot feedback you voluntarily provide to evaluate, troubleshoot and improve the product, without publishing your confidential business information or identifying you publicly without permission.
        </p>
      </LegalSection>

      <LegalSection title="10. Availability, changes and suspension">
        <p>
          Pilot features may be incomplete, changed, paused, withdrawn or discontinued. We may temporarily suspend access for maintenance, security, suspected misuse, legal compliance or operational reasons. We will use reasonable efforts to communicate material planned changes where practicable, but no service-level agreement, uptime percentage or continuous support commitment is created by these terms.
        </p>
      </LegalSection>

      <LegalSection title="11. Warranties and liability">
        <p>
          The pilot is provided for evaluation, and you must independently verify its outputs before relying on them for billing, tax, accounting, inventory, staffing, cash closure or other business decisions. To the extent permitted by law, the Operator does not warrant that the pilot will be uninterrupted, error-free, suitable for a particular business, compatible with every device, or sufficient to meet every statutory requirement.
        </p>
        <p>
          Nothing in these terms excludes or limits liability that cannot lawfully be excluded or limited, including applicable statutory consumer rights or liability for fraud or wilful misconduct. Subject to that restriction and applicable law, the Operator will not be responsible for indirect or consequential loss arising from use of a pilot version. Any other limitation of liability must be interpreted reasonably and only to the extent permitted by Indian law.
        </p>
      </LegalSection>

      <LegalSection title="12. Suspension, termination and return of data">
        <p>
          Either party may end pilot participation by written notice. We may suspend or end access immediately where reasonably necessary to address security risks, unlawful use, material breach or legal requirements. On exit, you should export or otherwise secure the records you need before uninstalling or resetting a device. Any data held by the Operator will be handled under the Privacy Policy and applicable retention requirements; this does not automatically delete data held locally on your own devices or backups.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law and disputes">
        <p>
          These terms are governed by the laws of India. The parties should first attempt to resolve a dispute through the support or legal contact listed on this page. Subject to mandatory consumer-protection provisions and any court or tribunal having jurisdiction under applicable law, courts of competent jurisdiction in {legalConfig.governingState}, India may hear disputes. Nothing in this clause removes a consumer's statutory right to approach a competent consumer commission or other authority.
        </p>
      </LegalSection>

      <LegalSection title="14. Changes to these terms">
        <p>
          We may update these terms as the pilot evolves or law changes. The revised version will show a new update date. If a change materially affects an existing pilot arrangement, we will seek acknowledgement or provide notice as reasonably appropriate. Continued use after an effective change constitutes acceptance only to the extent recognised by applicable law.
        </p>
      </LegalSection>

      <LegalSection title="15. Contact and grievances">
        <p>
          For questions, complaints or legal notices, contact {legalConfig.legalEmail} or write to {legalConfig.correspondenceAddress}. Please include the restaurant name, a description of the issue and a safe method to contact you. Do not email passwords, card data or other secrets.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

import { LegalPage, LegalSection, LegalList } from "@/components/legal/LegalPage";
import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Pilot & Beta Disclaimer | Order It Up",
  description: "Important limitations and evaluation terms for the Order It Up pre-registration pilot.",
};

export default function PilotDisclaimerPage() {
  return (
    <LegalPage
      title="Pilot & Beta Disclaimer"
      description="Order It Up is an early-stage software product being evaluated with pilot users. This page explains what that means before you rely on it in a live restaurant."
    >
      <LegalSection title="1. Pre-registration pilot status">
        <p>
          Order It Up is currently an early-stage product under development and community evaluation. It is being tested to understand restaurant requirements, validate workflows, identify defects and assess whether the product should be developed further. The pilot is operated by {legalConfig.operatorLegalName}. The product name does not represent that a company has already been incorporated or that a separate registered entity exists.
        </p>
        <p>
          Formal business registration, a broader commercial launch, pricing and additional investment or development decisions may be considered after pilot feedback and market validation. No promise is made that the product will become a registered company, receive investment, launch commercially or continue indefinitely.
        </p>
      </LegalSection>

      <LegalSection title="2. Evaluation purpose">
        <p>
          The pilot is intended to evaluate restaurant workflows such as billing, order handling, kitchen display, waiter operations, printing, cash-drawer integration and reporting. Features may be experimental, incomplete, unavailable in particular builds or different from demonstrations and marketing descriptions. A feature shown in a screenshot, demo or roadmap is not necessarily available in the current pilot build.
        </p>
      </LegalSection>

      <LegalSection title="3. No guaranteed availability">
        <p>
          The product may experience bugs, downtime, data-sync delays, device incompatibility, printing failures, local-network issues, power interruptions, data corruption or temporary loss of functionality. Offline-first design does not mean every feature is available without internet access or that data can never be lost.
        </p>
        <p>
          The pilot has no guaranteed uptime, response time, recovery time, backup frequency or service-level commitment unless a separate signed agreement expressly provides one.
        </p>
      </LegalSection>

      <LegalSection title="4. Protect business records">
        <LegalList items={[
          "Keep an independent backup of essential sales, invoice, customer, inventory and accounting records.",
          "Reconcile pilot reports against cash, payment terminal, bank, tax and accounting records before relying on them.",
          "Maintain a fallback billing and order process for outages or failed devices.",
          "Test restoration from backups before relying on them. A backup that has never been restored is not a verified recovery plan.",
          "Do not use an unverified pilot output as the sole basis for a tax filing, statutory return, audit, employee payment or legal decision."
        ]} />
      </LegalSection>

      <LegalSection title="5. Tax, food and regulatory responsibilities">
        <p>
          The pilot is not a tax adviser, chartered accountant, legal adviser, FSSAI licensing authority, GST portal, government system or certification body. It does not obtain GST registration, file GST returns, issue an FSSAI licence, certify a kitchen, or guarantee compliance with any law. A restaurant must independently determine and meet its applicable registrations, licences, invoices, disclosures, tax calculations, record keeping and filing obligations.
        </p>
      </LegalSection>

      <LegalSection title="6. Hardware and electrical safety">
        <p>
          Printer, ESC/POS and cash-drawer functionality depends on the exact model, firmware, drivers, cable, port, voltage, pulse configuration, power supply and operating system. A reference to a 24V cash-drawer pulse describes a possible hardware interface, not a guarantee of compatibility or a safety certification. Do not connect a device until its manufacturer documentation and electrical ratings have been checked by a competent person. Incorrect wiring may damage equipment or create a safety risk.
        </p>
      </LegalSection>

      <LegalSection title="7. Pilot access and pricing">
        <p>
          Any free pilot access is limited to the scope communicated to the participating business. It is not a commitment to a lifetime-free licence, a particular number of counters, future pricing or continued availability. No paid subscription should begin without separate, clear terms and affirmative acceptance by the business.
        </p>
      </LegalSection>

      <LegalSection title="8. Feedback and product changes">
        <p>
          Feedback is voluntary and may be used to diagnose issues and improve the product. Do not include customer personal data, passwords or confidential third-party information in feedback unless it is necessary and you are authorised to share it. The Operator may change, pause or discontinue a feature or the pilot, subject to applicable law and any separate written commitment.
        </p>
      </LegalSection>

      <LegalSection title="9. No waiver of legal rights">
        <p>
          This disclaimer does not remove rights or remedies that cannot lawfully be excluded under Indian law. If a specific pilot agreement provides stronger protection or a more specific obligation, that agreement will apply to the extent of any valid inconsistency.
        </p>
      </LegalSection>

      <LegalSection title="10. Contact">
        <p>
          Pilot questions, safety concerns or complaints: {legalConfig.supportEmail}. Legal notices: {legalConfig.legalEmail}. Operator: {legalConfig.operatorLegalName}.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

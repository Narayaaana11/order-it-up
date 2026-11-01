import { LegalPage, LegalSection, LegalList } from "@/components/legal/LegalPage";
import { legalConfig } from "@/lib/legal-config";

export const metadata = {
  title: "Privacy Policy | Order It Up",
  description: "How the Order It Up pilot handles personal and business information.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy describes the information that may be handled through the Order It Up website and pilot software, why it may be used, how it may be shared, and how to raise a privacy concern."
    >
      <LegalSection title="1. Who is responsible">
        <p>
          The Order It Up product pilot is operated by {legalConfig.operatorLegalName} ({legalConfig.operatorDescription}), at {legalConfig.correspondenceAddress} (the “Operator”). The Operator's privacy contact is {legalConfig.legalEmail}. Complete these identity and contact details before making this policy publicly available.
        </p>
        <p>
          A restaurant or other business using its own installation decides why it collects customer, employee, supplier and transaction information. Depending on the deployment, that business may be the organisation responsible for that information. The Operator may act separately for information collected for its own website, pilot administration, support and security, and may process restaurant information only on the restaurant's documented instructions where a connected feature is enabled. The actual role depends on the activity, not just the label used in a contract.
        </p>
      </LegalSection>

      <LegalSection title="2. Information that may be processed">
        <p>Depending on which parts of the pilot a business chooses to use, information may include:</p>
        <LegalList items={[
          "Pilot and account details: business or restaurant name, contact person's name, business email, phone number, pilot invitation details, account identifiers and support correspondence.",
          "Staff and access details: staff names or display names, usernames, role assignments, login and access events, and security-related records.",
          "Restaurant operations: menu items, product descriptions, prices, tables, orders, discounts, bills, cash closures, kitchen tickets, delivery status, inventory or other records entered by the restaurant.",
          "Customer and supplier details entered by the restaurant: for example, a customer name, phone number, email address, order notes, business contact or delivery details. The restaurant should collect only what it needs and is permitted to use.",
          "Technical and diagnostic information, if enabled or supplied: device and app version, operating-system details, error logs, timestamps, network diagnostics and information voluntarily attached to a support request.",
          "Website information: information a visitor submits through a contact, waitlist or pilot request form, plus basic server/security logs generated when the website is accessed."
        ]} />
        <p>
          Do not enter full card numbers, CVVs, PINs, net-banking credentials, passwords belonging to other services, Aadhaar numbers, health data or other sensitive information unless the relevant workflow expressly requires it and the Operator has provided a separate lawful and secure collection notice. Do not send such data in support tickets or email.
        </p>
      </LegalSection>

      <LegalSection title="3. Local storage and connected features">
        <p>
          Order It Up is designed to support local and offline-first restaurant workflows. Depending on the installation, order, billing, menu, staff and operational records may be stored on the restaurant's device or local network. The restaurant is responsible for physical access, device security, staff permissions and independent backups for locally stored data.
        </p>
        <p>
          The Operator does not automatically have access to every record stored only on a restaurant's device. Information may be sent to the Operator when a user submits it through the website or support channel, deliberately shares a diagnostic file or backup, or uses a connected feature such as hosted account services, remote support, cloud synchronisation, licensing, update delivery or telemetry, where that feature is actually enabled.
        </p>
        <p>
          Before enabling any hosted or remote feature that sends restaurant or personal data to the Operator or a service provider, the pilot onboarding materials must identify the feature, data categories, purpose, relevant service providers, hosting/processing locations and retention arrangements. Do not enable a connected feature until those details have been completed and the required customer instructions, notices and contractual terms are in place.
        </p>
      </LegalSection>

      <LegalSection title="4. Why information is used">
        <LegalList items={[
          "To respond to pilot requests, create and administer pilot access, and communicate with participating businesses.",
          "To provide the selected POS, kitchen, waiter, reporting, support and other features requested by the participating business.",
          "To diagnose errors, maintain security, prevent misuse, investigate incidents and improve reliability.",
          "To provide customer support, process user instructions, troubleshoot integrations and maintain technical records.",
          "To comply with applicable laws, lawful directions, accounting obligations and legitimate requests from competent authorities.",
          "To evaluate product feedback and improve the pilot, using aggregated or de-identified information where reasonably practicable."
        ]} />
        <p>
          We do not sell personal information. We do not use restaurant transaction records or customer lists for unrelated advertising. Do not use customer data for marketing unless the restaurant has separately established a lawful basis and provided any required notice or obtained consent.
        </p>
      </LegalSection>

      <LegalSection title="5. Legal basis, notices and permissions">
        <p>
          Information should be collected only for a clear, lawful and necessary purpose. Where the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 apply, the Operator will follow the applicable notice, consent, purpose limitation, disclosure, correction, withdrawal and security requirements, including the additional requirements for sensitive personal data or information.
        </p>
        <p>
          The Digital Personal Data Protection Act, 2023 and the Digital Personal Data Protection Rules, 2025 have phased commencement dates. As at 1 November 2026, the main processing obligations and Rules 3 and 5 to 16 are scheduled to commence eighteen months after publication of the commencement notification, on 13 May 2027. The Operator intends to prepare its processes for the applicable requirements before those provisions take effect. This statement is not a claim that every DPDP provision is already in force.
        </p>
        <p>
          The restaurant is responsible for giving its customers, employees and other individuals appropriate notices and obtaining permissions or establishing another lawful ground before entering their data into the software. The Operator will provide reasonable assistance where it processes that data on the restaurant's behalf under an agreed deployment.
        </p>
      </LegalSection>

      <LegalSection title="6. Sharing and service providers">
        <p>
          Information may be disclosed only as appropriate for the stated purpose, the selected feature, an applicable contract, the individual's permission where required, or a legal obligation. Potential recipients may include hosting or infrastructure providers, website and email providers, support tools, security providers, update delivery services and professional advisers, but only where the relevant service is actually used.
        </p>
        <p>
          <strong>Before enabling cloud or third-party processing, complete and publish the current provider list:</strong> provider name, service, data categories, processing purpose, processing location and link to its privacy terms. Do not leave a provider in this list merely because it is being considered; include only providers actually used by the production pilot.
        </p>
        <p>
          We may disclose information to law-enforcement, regulatory, tax, court or other public authorities where required by law or a valid legal process. We may also disclose information to investigate security incidents, protect users or enforce legal rights, where permitted by law.
        </p>
      </LegalSection>

      <LegalSection title="7. International processing">
        <p>
          The location of data processing depends on the infrastructure and providers selected for a particular deployment. The Operator must disclose the actual processing locations and assess applicable Indian transfer restrictions before enabling a service that transfers personal data outside India. No statement on this page should be read as a claim that all data is stored exclusively in India unless that has been verified for the relevant deployment.
        </p>
      </LegalSection>

      <LegalSection title="8. Retention and deletion">
        <p>
          Information should be kept only for as long as needed for the disclosed purpose, the pilot relationship, security and dispute handling, or a period required by applicable law. A restaurant's local records and backups may remain on devices under the restaurant's control after pilot access ends; the restaurant must manage those copies.
        </p>
        <p>
          The Operator must establish and document retention periods for website enquiries, account records, support tickets, diagnostic logs, security logs and any hosted restaurant data before full commercial launch. Applicable tax, accounting, contractual, CERT-In and other legal requirements may require certain records or logs to be retained for a prescribed period. Where applicable, CERT-In Directions require covered entities to maintain ICT system logs securely for a rolling 180-day period within Indian jurisdiction.
        </p>
        <p>
          Once the relevant DPDP provisions and Rules become applicable, the Operator will follow their retention, erasure, security-log, breach-intimation and grievance requirements to the extent applicable to its role and the processing activity. In particular, the applicable Rules include a one-year retention requirement for specified security logs and, for specified processing purposes, associated personal data and processing logs, subject to lawful longer retention requirements and the exact scope of those Rules. Deletion from an active system may not immediately remove copies in protected backups, which will be handled under the documented backup cycle and applicable law.
        </p>
      </LegalSection>

      <LegalSection title="9. Security and incident response">
        <p>
          The Operator should implement technical and organisational safeguards appropriate to the information it actually handles. Depending on the deployment, safeguards may include access controls, least-privilege access, authentication, secure configuration, encrypted transmission, protected backups, log monitoring, vulnerability management and staff confidentiality measures. Do not interpret this list as a certification or a representation that every control is currently implemented in every pilot build.
        </p>
        <p>
          If a suspected incident affects information held by the Operator, contact the privacy contact below. The Operator will assess and respond to incidents and make notifications to affected persons or authorities where required by applicable law. CERT-In reporting duties, including the six-hour reporting requirement for specified cyber incidents and log-retention directions, will be followed where applicable to the Operator or relevant service provider.
        </p>
      </LegalSection>

      <LegalSection title="10. Individual requests and grievances">
        <p>
          An individual may contact {legalConfig.legalEmail} to ask about personal information handled directly by the Operator, request correction where appropriate, withdraw a permission where applicable, or raise a privacy grievance. Please provide enough information to locate the relevant interaction, but do not send passwords, full payment credentials or identity documents unless a secure verification process is specifically arranged.
        </p>
        <p>
          Where information is held by a restaurant in its local system or the restaurant decides the purpose of processing, the individual should generally contact that restaurant first. The Operator will route or assist with a request where appropriate and where it has access or contractual responsibility. Requests will be handled within the time limits required by the law applicable at the time. Under the SPDI Rules, a covered body corporate must designate and publish a grievance contact and redress relevant grievances expeditiously within the prescribed one-month period.
        </p>
      </LegalSection>

      <LegalSection title="11. Children">
        <p>
          Order It Up is a business operations tool and is not intended to be an account service for children. Restaurant users should not create staff accounts for persons below the age permitted by applicable employment law or enter children's personal data unless necessary for a lawful restaurant transaction and handled with the notices and safeguards required by law. The Operator does not knowingly seek personal data from children through its pilot registration process.
        </p>
      </LegalSection>

      <LegalSection title="12. Cookies and website analytics">
        <p>
          The marketing website may use strictly necessary technologies to deliver pages, protect the site and remember essential settings. Any analytics, advertising, session replay or non-essential tracking technology must be disclosed here before it is enabled, including the provider, purpose and available controls. The website owner must verify the deployed code and hosting configuration; this policy does not certify that no third-party cookies or logs are present.
        </p>
      </LegalSection>

      <LegalSection title="13. Changes to this policy">
        <p>
          We may revise this policy to reflect changes in the pilot, providers, data flows or applicable law. The revised policy will display a new update date. Where a change materially affects how personal data is processed, we will provide additional notice or seek permission where required.
        </p>
      </LegalSection>

      <LegalSection title="14. Privacy contact">
        <p>
          Privacy and grievance contact: {legalConfig.legalEmail}. Correspondence address: {legalConfig.correspondenceAddress}. Operator: {legalConfig.operatorLegalName}. Please include “Privacy Request — Order It Up” in the subject line.
        </p>
      </LegalSection>
    </LegalPage>
  );
}

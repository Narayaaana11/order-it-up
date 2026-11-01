/**
 * PILOT LEGAL DETAILS
 * Do not invent a company name, CIN, GSTIN, registered office or certification.
 * Keep private residential details out of the public site. Arrange a suitable
 * business correspondence address and obtain an Indian-law review before full
 * commercial launch. An empty address intentionally keeps this config incomplete.
 */
export const legalConfig = {
  productName: "Order It Up",
  operatorLegalName: "Veera Venkata Naga Satyanarayana Thota",
  operatorDescription: "Founder",
  correspondenceAddress: "",
  legalEmail: "narayaaana11@gmail.com",
  supportEmail: "narayaaana11@gmail.com",
  phone: "",
  effectiveDate: "1 November 2026",
  lastUpdated: "1 November 2026",
  governingState: "Andhra Pradesh",
};

export const legalPlaceholderFields = [
  "operatorLegalName",
  "operatorDescription",
  "correspondenceAddress",
  "legalEmail",
  "supportEmail",
] as const;

export function isLegalConfigComplete() {
  return legalPlaceholderFields.every((key) => {
    const value = legalConfig[key];
    return typeof value === "string" && value.trim().length > 0 && !value.includes("[INSERT") && !value.includes("[OPTIONAL");
  });
}

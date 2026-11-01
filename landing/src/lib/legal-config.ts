/**
 * REQUIRED BEFORE PUBLICATION
 * Replace every value below with accurate operator details.
 * Do not invent a company name, CIN, GSTIN, registered office or certification.
 * If no company has been incorporated, identify the actual individual / existing
 * legal person operating the pilot and provide a valid correspondence address.
 */
export const legalConfig = {
  productName: "Order It Up",
  operatorLegalName: "Veera Venkata Naga Satyanarayana Thota",
  operatorDescription: "Founder",
  correspondenceAddress: "5-77/1, Padma Shri Street, Near Maddiramma Center, Doddanapudi, Kalla Mandal, West Godavari District, Andhra Pradesh, India - 534237",
  legalEmail: "narayaaana11@gmail.com",
  supportEmail: "narayaaana11@gmail.com",
  phone: "+91 6301253789",
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
    return typeof value === "string" && !value.includes("[INSERT") && !value.includes("[OPTIONAL");
  });
}

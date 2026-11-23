# Indian Goods and Services Tax (GST) & Food Safety (FSSAI) Compliance Guide

> **Current Official Reference Date:** November 2026 / FY 2025–26  
> **Applicable Statutory Authority:** Central Board of Indirect Taxes and Customs (CBIC), GST Council Notifications, Food Safety and Standards Authority of India (FSSAI).

---

## 1. Statutory Context & Legal Basis

Restaurant and catering services in India are classified under the **Scheme of Classification of Services** according to Chapter 99 of the Services Accounting Code (SAC).

### Primary SAC Code
- **SAC 996331:** Services provided by restaurants, cafes, and similar eating facilities including takeaway services, room services, and door delivery of food.

### Tax Rate Architecture (Notification No. 11/2017-Central Tax (Rate) as amended by Notification No. 46/2017-CT(Rate) & 20/2019-CT(Rate))

1. **Standalone Restaurants (AC or Non-AC):**
   - **GST Rate:** **5% without Input Tax Credit (ITC)**.
   - **Intra-State Transactions (within the same State/UT):**
     - CGST: **2.5%**
     - SGST / UTGST: **2.5%**
   - **Inter-State Transactions (cross-border delivery/supply):**
     - IGST: **5.0%**
2. **Restaurants in Specified Premises (Hotel Room Tariff >= ₹7,500/night):**
   - **GST Rate:** **18% with Input Tax Credit (ITC)**.
   - CGST: **9.0%** + SGST: **9.0%** (Intra-state) or IGST: **18.0%** (Inter-state).
3. **Outdoor Catering:**
   - **GST Rate:** **5% without ITC** (unless conducted in specified premises where room tariff >= ₹7,500).
4. **Composition Scheme Restaurants (Section 10 of CGST Act):**
   - **Turnover Limit:** Aggregate annual turnover up to ₹1.5 Crore (₹75 Lakhs in Special Category States).
   - **Tax Rate:** 5% of aggregate turnover (2.5% CGST + 2.5% SGST).
   - **Key Invariant:** Under Section 10(4), composition taxpayers **cannot collect GST from customers** and must issue a **"Bill of Supply"** instead of a "Tax Invoice", with the mandatory endorsement: *"Composition taxable person, not eligible to collect tax on supplies"*.

---

## 2. Place of Supply Rules (IGST Act Section 12(4))

- Under Section 12(4) of the IGST Act, the **place of supply of restaurant and catering services is the location where the services are actually performed**.
- For dine-in and takeaway, the place of supply is always the outlet premise (Intra-state CGST + SGST).
- For inter-state delivery (e.g., outlet in Noida, UP delivering across state line to Delhi), supply is Inter-State IGST.

---

## 3. Service Charges & GST Treatment

- In accordance with CCPA guidelines and CBIC clarifications, any voluntary or contractual service charge levied by a restaurant forms part of the **value of supply** under Section 15 of the CGST Act.
- Service charges attract GST at the same applicable rate as the underlying food service (e.g. 5% or 18%).

---

## 4. Invoice Requirements & Mandatory Receipt Fields

Under Rule 46 of the CGST Rules, 2017, every Tax Invoice issued by a registered restaurant must carry:
1. **Name, address, and GSTIN** of the supplier.
2. **FSSAI License Number** (14-digit numeric identifier required under FSSAI Order F. No. 12(1)2020/FSSAI/Enf/Standards on all food bills/invoices).
3. **Sequential Serial Number** (not exceeding 16 characters, unique for a financial year, consecutive and gap-free).
4. **Date of issue**.
5. **Name, address, and GSTIN / UIN** of the recipient (if registered for B2B; mandatory when recipient claims ITC).
6. **HSN / SAC Code** of food items and services (SAC 996331).
7. **Description, unit price, quantity, and total value** of each item.
8. **Discounts** allowed before or at the time of supply.
9. **Rate of tax** and **breakdown of taxes** (CGST, SGST, IGST clearly separated).
10. **Rounding off** to the nearest whole rupee under Section 170 of the CGST Act.
11. **Total Amount in Words** (standard banking/commercial practice).

---

## 5. B2B E-Invoicing (IRP) Readiness

- **Current Statutory Threshold:** Mandatory e-invoicing under Notification No. 10/2023-Central Tax applies to registered entities whose aggregate annual turnover exceeds ₹5 Crore in any preceding financial year since 2017–18.
- B2B invoices and B2B Credit Notes must be reported to the Invoice Registration Portal (IRP) to obtain an **IRN** (Invoice Reference Number) and signed QR code.
- Order It Up implements local standard schema export (`einvoice_status = 'pending' | 'generated' | 'cancelled'`) generating the official JSON schema format for B2B invoices.

"use client";

import React, { useState, useMemo } from "react";
import {
  FileSpreadsheet,
  Download,
  ShieldCheck,
  CheckCircle2,
  DollarSign,
  Receipt,
  Code2,
  Copy,
  Check,
  Plus,
  X,
} from "lucide-react";
import {
  useZReports,
  useActiveCashShift,
  useOutlets,
  useDashboardActions,
} from "@/lib/dashboard-store";
import type { ShiftZReport, ShiftClosureInput } from "@/lib/dashboard-models";

export function AccountantView() {
  const zReports = useZReports();
  const activeCashShift = useActiveCashShift();
  const outlets = useOutlets();
  const actions = useDashboardActions();

  // Active Outlet (Downtown Bistro Flagship)
  const currentOutlet = outlets.find((o) => o.id === "outlet-1") || outlets[0];

  // Selected Z-Report for inspection
  const [selectedZReportId, setSelectedZReportId] = useState<string>(
    zReports[0]?.id || "zreport-42"
  );

  // New Shift Closure Modal
  const [showClosureModal, setShowClosureModal] = useState<boolean>(false);
  const [countedCashInput, setCountedCashInput] = useState<string>("19150");
  const [supervisorNameInput, setSupervisorNameInput] = useState<string>("Priya Sharma");
  const [closureNotesInput, setClosureNotesInput] = useState<string>(
    "EOD Shift close for POS-01. ₹50 shortage flagged against expected cash."
  );

  // XML Copy state
  const [copiedXml, setCopiedXml] = useState<boolean>(false);

  // Selected Z-Report object
  const activeReport = useMemo(() => {
    return zReports.find((z) => z.id === selectedZReportId) || zReports[0];
  }, [zReports, selectedZReportId]);

  // Overall GST Metrics for today
  const totalTaxable = useMemo(() => {
    return currentOutlet.todaySales / 1.05;
  }, [currentOutlet]);

  const totalCgst = useMemo(() => {
    return totalTaxable * 0.025;
  }, [totalTaxable]);

  const totalSgst = useMemo(() => {
    return totalTaxable * 0.025;
  }, [totalTaxable]);

  const totalGst = totalCgst + totalSgst;

  // Generate Standard Tally ERP 9 / Prime XML Voucher
  const generateTallyXml = (report: ShiftZReport): string => {
    const dateFormatted = report.businessDate.replace(/-/g, "");
    const salesTaxable = (report.grossSalesTotal / 1.05).toFixed(2);
    const cgstAmt = (report.grossSalesTotal * 0.025 / 1.05).toFixed(2);
    const sgstAmt = (report.grossSalesTotal * 0.025 / 1.05).toFixed(2);
    const varianceAbs = Math.abs(report.cashVariance).toFixed(2);

    return `<?xml version="1.0" encoding="utf-8"?>
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Spice Route Hospitality Group</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
          <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
            <DATE>${dateFormatted}</DATE>
            <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
            <VOUCHERNUMBER>RCP-${dateFormatted}-Z${report.zNumber}</VOUCHERNUMBER>
            <REFERENCE>Z-Report #${report.zNumber} (${currentOutlet.code})</REFERENCE>
            <PARTYLEDGERNAME>Cash Counter Drawer</PARTYLEDGERNAME>
            <NARRATION>End of Day Z-Report #${report.zNumber} Cashier: ${report.cashierName} Supervisor: ${report.supervisorName} SAC 996331 Restaurant &amp; Catering Services</NARRATION>
            
            <!-- Cash In Hand (Debit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Cash Counter Drawer</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${report.actualCountedCash.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- UPI Clearing (Debit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>UPI Digital Clearing Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${report.upiTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Card POS Clearing (Debit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Card POS Settlement Account</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>-${report.cardTotal.toFixed(2)}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Restaurant Sales Account (Credit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Restaurant Sales Account (SAC 996331)</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${salesTaxable}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Output CGST @ 2.5% (Credit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output CGST @ 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${cgstAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>

            <!-- Output SGST @ 2.5% (Credit) -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>Output SGST @ 2.5%</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>${sgstAmt}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            ${
              report.cashVariance !== 0
                ? `
            <!-- Cash Over/Short Variance -->
            <ALLLEDGERENTRIES.LIST>
              <LEDGERNAME>${report.cashVariance < 0 ? "Cash Shortage Expense" : "Cash Over Counter Income"}</LEDGERNAME>
              <ISDEEMEDPOSITIVE>${report.cashVariance < 0 ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
              <AMOUNT>${report.cashVariance < 0 ? varianceAbs : `-${varianceAbs}`}</AMOUNT>
            </ALLLEDGERENTRIES.LIST>`
                : ""
            }
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
  };

  // Download Tally XML Blob File
  const handleDownloadTallyXml = () => {
    if (!activeReport) return;
    const xmlContent = generateTallyXml(activeReport);
    const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tally_receipt_z${activeReport.zNumber}_${activeReport.businessDate}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Copy XML to clipboard
  const handleCopyXml = () => {
    if (!activeReport) return;
    const xmlContent = generateTallyXml(activeReport);
    navigator.clipboard.writeText(xmlContent);
    setCopiedXml(true);
    setTimeout(() => setCopiedXml(false), 2000);
  };

  // Submit Shift Closure
  const handleRecordClosure = (e: React.FormEvent) => {
    e.preventDefault();
    const countedVal = parseFloat(countedCashInput) || 0;
    const closureInput: ShiftClosureInput = {
      outletId: currentOutlet.id,
      cashierName: "Rohit Singh",
      supervisorName: supervisorNameInput,
      actualCountedCash: countedVal,
      notes: closureNotesInput,
      nextOpeningFloat: 5000,
    };

    const newReport = actions.recordShiftClosure(closureInput);
    setSelectedZReportId(newReport.id);
    setShowClosureModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Top Header Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              GST Compliance Active
            </span>
            <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-orange-800 text-[11px] font-bold">
              Accountant: Kavita Rao (PIN: 3391)
            </span>
            <span className="text-xs text-slate-500 hidden sm:inline">
              GSTIN: {currentOutlet.gstin} • State: 07 Delhi
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-[#F07928]" />
            GST Tax Audit, Z-Reports &amp; Tally XML
          </h2>
          <p className="text-xs text-slate-600 max-w-2xl">
            Indian GST calculation (SAC 996331 Restaurant &amp; Catering), FSSAI license compliance verification, daily Z-Report drawer reconciliation, and 1-click Tally ERP 9 / Prime XML export.
          </p>
        </div>

        {/* Global Accountant Actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowClosureModal(true)}
            className="px-4 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-400" />
            <span>Close Shift &amp; Issue Z-Report</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTallyXml}
            className="px-4 py-2.5 rounded-2xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Tally XML</span>
          </button>
        </div>
      </div>

      {/* INDIAN GST & FSSAI COMPLIANCE CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Taxable Value */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Taxable Turnover</span>
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalTaxable.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500">
            SAC 996331 • Restaurant Catering
          </div>
        </div>

        {/* Card 2: CGST @ 2.5% */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Central GST (CGST)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
              2.5%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalCgst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-blue-700 font-medium">
            Central Tax Ledger #CGST-07
          </div>
        </div>

        {/* Card 3: SGST @ 2.5% */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">State GST (SGST)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">
              2.5%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalSgst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-purple-700 font-medium">
            Delhi State Tax Ledger #SGST-07
          </div>
        </div>

        {/* Card 4: Total GST (5.0%) */}
        <div className="p-5 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs">
            <span className="font-bold uppercase tracking-wider">Total GST (5.0%)</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
              5.0%
            </span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">
            ₹{totalGst.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-emerald-700 font-medium">
            Combined 5.0% GST Output
          </div>
        </div>

        {/* Card 5: FSSAI Compliance Verification Badge */}
        <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-emerald-800 text-xs">
            <span className="font-bold uppercase tracking-wider">FSSAI Compliance</span>
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="text-base font-black text-emerald-950 font-mono">
            #{currentOutlet.fssaiNumber || "10019011000234"}
          </div>
          <div className="text-xs text-emerald-700 flex items-center gap-1 font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>State 07 Delhi • Active</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Z-Report Balancing Table (8 cols), Tally XML Export Card (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column (8 cols): Z-Report Shift Closure Balancing Ledger */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-[#F07928]" />
                  Z-Report Shift Closure Balancing Table
                </h3>
                <p className="text-xs text-slate-500">
                  Daily register closing audits with expected cash vs physical counted cash variance flags.
                </p>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {zReports.length} Historical Z-Reports
              </span>
            </div>

            {/* Z-Reports Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                    <th className="pb-3">Z#</th>
                    <th className="pb-3">Date &amp; Terminal</th>
                    <th className="pb-3">Cashier / Sup</th>
                    <th className="pb-3 text-right">Opening Float</th>
                    <th className="pb-3 text-right">Expected Cash</th>
                    <th className="pb-3 text-right">Counted Cash</th>
                    <th className="pb-3 text-right">Variance</th>
                    <th className="pb-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {zReports.map((rep) => {
                    const isSelected = rep.id === selectedZReportId;

                    return (
                      <tr
                        key={rep.id}
                        onClick={() => setSelectedZReportId(rep.id)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-orange-50/70 font-semibold" : "hover:bg-slate-50/50"
                        }`}
                      >
                        <td className="py-3 font-mono font-bold text-slate-900">
                          Z-{rep.zNumber}
                        </td>
                        <td className="py-3">
                          <div className="text-slate-900 font-bold">{rep.businessDate}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{rep.terminalId}</div>
                        </td>
                        <td className="py-3">
                          <div className="text-slate-900">{rep.cashierName}</div>
                          <div className="text-[10px] text-slate-400">Sup: {rep.supervisorName}</div>
                        </td>
                        <td className="py-3 text-right font-mono">
                          ₹{rep.openingFloat.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          ₹{rep.expectedCashInDrawer.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 text-right font-mono font-bold text-slate-900">
                          ₹{rep.actualCountedCash.toLocaleString("en-IN")}
                        </td>
                        <td className="py-3 text-right font-mono font-bold">
                          <span
                            className={
                              rep.cashVariance < 0
                                ? "text-red-600"
                                : rep.cashVariance > 0
                                ? "text-blue-600"
                                : "text-emerald-600"
                            }
                          >
                            {rep.cashVariance > 0 ? `+₹${rep.cashVariance.toFixed(2)}` : `₹${rep.cashVariance.toFixed(2)}`}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              rep.status === "balanced"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {rep.status === "balanced" ? "Balanced" : "Shortage"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Selected Report Notes Banner */}
            {activeReport && (
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div>
                  <span className="font-bold text-slate-800">
                    Selected Z-Report #{activeReport.zNumber} ({activeReport.businessDate}):
                  </span>{" "}
                  <span className="text-slate-600">{activeReport.notes}</span>
                </div>
                <div className="font-mono text-slate-500 text-[11px] shrink-0">
                  Total Tax: ₹{activeReport.totalTaxCollected.toFixed(2)} • Bills: {activeReport.totalBillsIssued}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (4 cols): 1-Click Tally ERP 9 / Prime XML Voucher Card */}
        <div className="lg:col-span-4 space-y-4">
          <div className="p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Code2 className="w-4 h-4 text-orange-600" />
                Tally ERP 9 / Prime XML Voucher
              </h3>
              <button
                type="button"
                onClick={handleCopyXml}
                className="text-xs text-orange-600 hover:text-orange-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                {copiedXml ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedXml ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Compliant Tally XML receipt voucher with Cash Counter Drawer, UPI Clearing, and SAC 996331 Sales ledgers ready for instant import.
            </p>

            {/* XML Snippet Preview Box */}
            <div className="p-3 bg-slate-900 rounded-2xl text-[10px] font-mono text-slate-200 overflow-x-auto max-h-60 leading-relaxed border border-slate-800 shadow-inner">
              <pre>{activeReport ? generateTallyXml(activeReport).slice(0, 750) + "\n... [Full Voucher Envelope]" : ""}</pre>
            </div>

            {/* 1-Click Download Button */}
            <button
              type="button"
              onClick={handleDownloadTallyXml}
              className="w-full py-3 rounded-2xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Tally XML File (.xml)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SHIFT CLOSURE & Z-REPORT MODAL */}
      {showClosureModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="p-5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-orange-600" />
                <span className="text-sm font-black text-slate-900">Record Shift Closure &amp; Z-Report</span>
              </div>
              <button
                type="button"
                onClick={() => setShowClosureModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRecordClosure} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-orange-50 border border-orange-200 text-orange-800 space-y-1">
                <div className="font-bold">Active Shift Till Snapshot:</div>
                <div className="font-mono flex justify-between">
                  <span>Opening Float: ₹{activeCashShift.openingFloat.toFixed(2)}</span>
                  <span>Gross Cash: ₹{activeCashShift.grossCashSales.toFixed(2)}</span>
                </div>
                <div className="font-mono font-bold text-slate-900 flex justify-between pt-1 border-t border-orange-200">
                  <span>Expected Cash in Drawer:</span>
                  <span>₹{activeCashShift.expectedCashInDrawer.toFixed(2)}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Actual Counted Physical Cash (₹):</label>
                <input
                  type="number"
                  required
                  value={countedCashInput}
                  onChange={(e) => setCountedCashInput(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-300 font-mono font-bold text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Authorizing Supervisor Name:</label>
                <input
                  type="text"
                  required
                  value={supervisorNameInput}
                  onChange={(e) => setSupervisorNameInput(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-700">Supervisor Closure Notes &amp; Variance Explanation:</label>
                <textarea
                  rows={3}
                  value={closureNotesInput}
                  onChange={(e) => setClosureNotesInput(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowClosureModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-[#F07928] hover:bg-[#EA580C] text-white font-bold cursor-pointer shadow-xs"
                >
                  Generate Z-Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
export default AccountantView;

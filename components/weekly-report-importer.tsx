"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type StaffOption = {
  id: string;
  code: string;
  fullName: string;
};

type Preview = {
  counts: {
    accounts: number;
    payments: number;
    products: number;
  };
  staffCodes: string[];
  currentStaff: StaffOption[];
  autoMapping: Record<string, string>;
  warnings: string[];
};

type ImportResult = {
  customersCreated: number;
  customersUpdated: number;
  productsCreated: number;
  accountsCreated: number;
  accountsSkipped: number;
  paymentsCreated: number;
  paymentsSkipped: number;
  openingAdjustmentsCreated: number;
};

async function responseMessage(response: Response) {
  const body = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;
  return body?.error || `Request failed (${response.status}).`;
}

export function WeeklyReportImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    crypto.randomUUID()
  );

  async function previewFile() {
    if (!file) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/admin/weekly-report-import/preview", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const data = (await response.json()) as Preview;
      setPreview(data);
      setMapping(data.autoMapping);
      setConfirmed(false);
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : "Could not read the report.");
    } finally {
      setBusy(false);
    }
  }

  async function importReport() {
    if (!file || !preview) return;
    setBusy(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("staffMapping", JSON.stringify(mapping));
      const response = await fetch("/api/admin/weekly-report-import/commit", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: formData,
      });
      if (!response.ok) throw new Error(await responseMessage(response));
      const body = (await response.json()) as { counts: ImportResult };
      setResult(body.counts);
      setPreview(null);
      setIdempotencyKey(crypto.randomUUID());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The import failed.");
    } finally {
      setBusy(false);
    }
  }

  const allMapped =
    preview?.staffCodes.every((code) => Boolean(mapping[code])) ?? false;
  const canImport =
    Boolean(preview) &&
    allMapped &&
    confirmed &&
    !preview?.warnings.length &&
    !busy;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-lime-700" />
            Select the exported weekly report
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setResult(null);
              setError("");
            }}
          />
          <Button type="button" onClick={previewFile} disabled={!file || busy}>
            {busy && !preview ? "Reading report..." : "Preview recovery"}
          </Button>
        </CardContent>
      </Card>

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {result ? (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-900">
              <CheckCircle2 className="h-5 w-5" />
              Recovery import completed
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-green-900 sm:grid-cols-2">
            <p>{result.customersCreated} customers created</p>
            <p>{result.customersUpdated} customers updated</p>
            <p>{result.productsCreated} products created</p>
            <p>{result.accountsCreated} accounts created</p>
            <p>{result.paymentsCreated} weekly payments created</p>
            <p>{result.openingAdjustmentsCreated} opening balances reconstructed</p>
            <p>{result.accountsSkipped} existing accounts skipped</p>
            <p>{result.paymentsSkipped} existing payments skipped</p>
          </CardContent>
        </Card>
      ) : null}

      {preview ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Report preview</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold">{preview.counts.accounts}</p>
                <p className="text-sm text-gray-600">Customer accounts</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold">{preview.counts.payments}</p>
                <p className="text-sm text-gray-600">Weekly payments</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-2xl font-bold">{preview.counts.products}</p>
                <p className="text-sm text-gray-600">Product rows</p>
              </div>
            </CardContent>
          </Card>

          {preview.warnings.length ? (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4">
              <div className="flex gap-2 text-amber-900">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="font-semibold">Import blocked until these report problems are resolved:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
                    {preview.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Map old staff codes to current staff</CardTitle>
              <p className="text-sm text-gray-600">
                The spreadsheet contains old staff codes, not database IDs. Choose the newly recreated staff member who owns each code.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {preview.staffCodes.map((code) => (
                <div key={code} className="grid gap-2 sm:grid-cols-[12rem_1fr] sm:items-center">
                  <label htmlFor={`staff-${code}`} className="font-medium">
                    Old code: {code}
                  </label>
                  <select
                    id={`staff-${code}`}
                    value={mapping[code] ?? ""}
                    onChange={(event) =>
                      setMapping((current) => ({
                        ...current,
                        [code]: event.target.value,
                      }))
                    }
                    className="h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm"
                  >
                    <option value="">Select current staff member</option>
                    {preview.currentStaff.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.code} — {staff.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardContent className="space-y-4 pt-6">
              <label className="flex items-start gap-3 text-sm leading-6">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(event) => setConfirmed(event.target.checked)}
                  className="mt-1 h-4 w-4"
                />
                <span>
                  I understand this report can recover products, customers, accounts and the payments listed for its week. Earlier paid totals will be recorded as clearly labelled recovered opening balances because their original receipt dates are unavailable.
                </span>
              </label>
              <Button type="button" onClick={importReport} disabled={!canImport}>
                {busy ? "Importing safely..." : "Import recovered data"}
              </Button>
              {!allMapped ? (
                <p className="text-sm text-amber-800">Map every old staff code before importing.</p>
              ) : null}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

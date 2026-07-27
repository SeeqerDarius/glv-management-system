"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { HandCoins } from "lucide-react";
import {
  PaymentForm,
  type PaymentAccountOption,
} from "@/components/payment-form";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type PaymentModalProps = {
  accounts: PaymentAccountOption[];
  selectedCustomerId?: string;
  selectedAccountId?: string;
  customerName?: string;
  trigger?: ReactNode;
  triggerLabel?: string;
};

export function PaymentModal({
  accounts,
  selectedCustomerId,
  selectedAccountId,
  customerName,
  trigger,
  triggerLabel = "Record Payment",
}: PaymentModalProps) {
  const [open, setOpen] = useState(false);
  const [receiptNo, setReceiptNo] = useState("");
  const closeAfterSuccess = useCallback((receipt: string) => {
    setReceiptNo(receipt);
    setOpen(false);
  }, []);

  useEffect(() => {
    if (!receiptNo) return;
    const timer = window.setTimeout(() => setReceiptNo(""), 6000);
    return () => window.clearTimeout(timer);
  }, [receiptNo]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <HandCoins className="size-4" />
              {triggerLabel}
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-h-[92vh] overflow-y-auto p-0 sm:max-w-2xl">
          <DialogHeader className="px-5 pt-5">
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {customerName
                ? `Record a payment for ${customerName}.`
                : "Select an active account and enter the amount received."}
            </DialogDescription>
          </DialogHeader>
          <PaymentForm
            key={`${selectedAccountId ?? "account"}-${open ? "open" : "closed"}`}
            accounts={accounts}
            selectedCustomerId={selectedCustomerId}
            selectedAccountId={selectedAccountId}
            inline
            onCancel={() => setOpen(false)}
            onSuccess={closeAfterSuccess}
          />
        </DialogContent>
      </Dialog>
      {receiptNo ? (
        <p
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-lg border border-lime-300 bg-lime-50 px-4 py-3 text-sm font-medium text-lime-950 shadow-lg"
        >
          Payment recorded. Receipt: {receiptNo}
        </p>
      ) : null}
    </>
  );
}

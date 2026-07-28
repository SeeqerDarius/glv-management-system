import Link from "next/link";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { PrintDocumentButton } from "@/components/print-document-button";
import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export default async function CustomerDocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  const document = await prisma.customerDocument.findUnique({
    where: { id },
    include: {
      customer: { include: { staff: true } },
      account: { include: { product: true } },
    },
  });
  if (!document) notFound();
  if (
    !isAdminRole(session.user.role) &&
    document.customer.staffId !== session.user.staffId
  ) {
    redirect("/dashboard");
  }
  const setting = await prisma.setting.findFirst();
  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex justify-between gap-3 print:hidden">
        <Button asChild variant="outline"><Link href={document.accountId ? `/accounts/${document.accountId}` : `/customers/${document.customerId}`}>Back</Link></Button>
        <PrintDocumentButton />
      </div>
      <article className="min-h-[1050px] bg-white p-8 shadow-sm print:min-h-0 print:p-0 print:shadow-none md:p-14">
        <header className="border-b-2 border-lime-600 pb-5 text-center">
          {setting?.logoUrl ? <Image src={setting.logoUrl} alt="" width={180} height={64} unoptimized className="mx-auto mb-3 h-16 w-auto object-contain" /> : null}
          <h1 className="text-2xl font-bold">{setting?.companyName || "GLV"}</h1>
          <p className="mt-1 text-sm text-gray-600">{[setting?.address, setting?.phone, setting?.email].filter(Boolean).join(" • ")}</p>
        </header>
        <div className="mt-8">
          <h2 className="text-center text-xl font-bold uppercase">{document.title}</h2>
          <p className="mt-2 text-center text-xs text-gray-500">Document reference: {document.id}</p>
          <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-gray-900">{document.content}</div>
        </div>
        <footer className="mt-12 border-t pt-5 text-xs text-gray-500">
          Generated {document.createdAt.toLocaleString("en-GB")} for {document.customer.fullName}. This document is an immutable record of the template and figures used when generated.
        </footer>
      </article>
    </div>
  );
}

import Image from "next/image";
import { notFound } from "next/navigation";
import { PrintDocumentButton } from "@/components/print-document-button";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function PublicCustomerDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const [document, setting] = await Promise.all([
    prisma.customerDocument.findUnique({
      where: { publicToken: token },
      include: { customer: { select: { fullName: true } } },
    }),
    prisma.setting.findFirst(),
  ]);
  if (!document) notFound();
  return (
    <main className="min-h-screen bg-gray-100 p-4 print:bg-white print:p-0">
      <div className="mx-auto mb-4 flex max-w-4xl justify-end print:hidden">
        <PrintDocumentButton />
      </div>
      <article className="mx-auto min-h-[1050px] max-w-4xl bg-white p-8 shadow-sm print:min-h-0 print:p-0 print:shadow-none md:p-14">
        <header className="border-b-2 border-lime-600 pb-5 text-center">
          {setting?.logoUrl ? <Image src={setting.logoUrl} alt="" width={180} height={64} unoptimized className="mx-auto mb-3 h-16 w-auto object-contain" /> : null}
          <h1 className="text-2xl font-bold">{setting?.companyName || "GLV"}</h1>
          <p className="mt-1 text-sm text-gray-600">{[setting?.address, setting?.phone, setting?.email].filter(Boolean).join(" • ")}</p>
        </header>
        <h2 className="mt-8 text-center text-xl font-bold uppercase">{document.title}</h2>
        <p className="mt-2 text-center text-xs text-gray-500">Document reference: {document.id}</p>
        <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-gray-900">{document.content}</div>
        <footer className="mt-12 border-t pt-5 text-xs text-gray-500">
          Generated {document.createdAt.toLocaleString("en-GB")} for {document.customer.fullName}. Verify questions through GLV’s official contact details above.
        </footer>
      </article>
    </main>
  );
}

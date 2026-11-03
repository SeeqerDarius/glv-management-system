const PAGE_WIDTH = 842;
const PAGE_HEIGHT = 595;

function pdfText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "?")
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
}

export function buildTextPdf(title: string, lines: string[]) {
  const wrapped = lines.flatMap((line) => {
    const value = line || " ";
    const chunks: string[] = [];
    for (let index = 0; index < value.length; index += 112) {
      chunks.push(value.slice(index, index + 112));
    }
    return chunks;
  });
  const perPage = 34;
  const pages = Array.from({ length: Math.max(1, Math.ceil(wrapped.length / perPage)) }, (_, index) =>
    wrapped.slice(index * perPage, (index + 1) * perPage)
  );
  const objects: string[] = [];
  const pageIds = pages.map((_, index) => 4 + index * 2);
  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  pages.forEach((pageLines, pageIndex) => {
    const pageId = 4 + pageIndex * 2;
    const contentId = pageId + 1;
    const content = [
      "BT",
      "/F1 16 Tf",
      `50 ${PAGE_HEIGHT - 42} Td`,
      `(${pdfText(title)}) Tj`,
      "/F1 9 Tf",
      "0 -26 Td",
      ...pageLines.flatMap((line) => [`(${pdfText(line)}) Tj`, "0 -14 Td"]),
      "ET",
    ].join("\n");
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`);
  });

  let output = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(output, "ascii"));
    output += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(output, "ascii");
  output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  output += offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(output, "ascii");
}

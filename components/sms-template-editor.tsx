"use client";

import { useState } from "react";
import { renderSmsTemplate, SMS_TEMPLATE_DEFINITIONS, type SmsTemplateKey } from "@/lib/sms-templates";

export function SmsTemplateEditor({ templateKey, initialValue }: { templateKey: SmsTemplateKey; initialValue: string }) {
  const definition = SMS_TEMPLATE_DEFINITIONS[templateKey];
  const [value, setValue] = useState(initialValue);
  let preview = "";
  let error = "";
  try { preview = renderSmsTemplate(templateKey, value, definition.previewValues); }
  catch (cause) { error = cause instanceof Error ? cause.message : "Invalid message template."; }

  return <section className="space-y-3 rounded-lg border p-4">
    <div><h3 className="font-semibold">{definition.label}</h3><p className="text-sm text-gray-600">{definition.description}</p></div>
    <label className="block text-sm font-medium" htmlFor={`sms-template-${templateKey}`}>Message template</label>
    <textarea id={`sms-template-${templateKey}`} name={`${templateKey}Template`} value={value}
      onChange={(event) => setValue(event.target.value)} rows={4} maxLength={612} required
      className="w-full rounded border px-3 py-2" />
    <div className="flex flex-wrap gap-2 text-xs">{definition.placeholders.map(name =>
      <button key={name} type="button" className="rounded border bg-gray-50 px-2 py-1"
        onClick={() => setValue(current => `${current}${current.endsWith(" ") || !current ? "" : " "}{{${name}}}`)}>
        {`{{${name}}}`}
      </button>)}</div>
    <div className="rounded bg-gray-50 p-3 text-sm"><p className="mb-1 font-medium">Preview</p>
      {error ? <p className="text-red-700">{error}</p> : <p>{preview}</p>}
      <p className="mt-2 text-xs text-gray-500">{value.length}/612 template characters</p></div>
    <button type="button" className="text-sm underline" onClick={() => setValue(definition.defaultTemplate)}>Reset this message to default</button>
  </section>;
}

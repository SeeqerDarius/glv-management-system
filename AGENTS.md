<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Operator handbook maintenance

Every user-visible workflow, permission, business rule, integration, report,
setting, deployment procedure, or operational behavior change must update the
operator documentation in the same change set. Keep `OPERATOR_HANDOFF.md`,
`documentation/build_glv_system_manual.py`, and
`docs/build_system_documentation.py` aligned, then regenerate and verify the
affected DOCX/PDF deliverables before committing and deploying. Documentation
updates are a completion requirement, not an optional follow-up.

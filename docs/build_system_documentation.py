from __future__ import annotations

from datetime import datetime
from pathlib import Path
from textwrap import dedent
from zipfile import ZIP_DEFLATED, ZipFile
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "GLV_System_Documentation.docx"

NS = (
    'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" '
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" '
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" '
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"'
)


def t(value: object) -> str:
    return escape(str(value), {'"': "&quot;"})


def run(text: str, bold: bool = False, italic: bool = False, color: str | None = None) -> str:
    props = []
    if bold:
        props.append("<w:b/>")
    if italic:
        props.append("<w:i/>")
    if color:
        props.append(f'<w:color w:val="{color}"/>')
    rpr = f"<w:rPr>{''.join(props)}</w:rPr>" if props else ""
    return f"<w:r>{rpr}<w:t xml:space=\"preserve\">{t(text)}</w:t></w:r>"


def para(
    text: str = "",
    style: str = "Normal",
    bold: bool = False,
    italic: bool = False,
    color: str | None = None,
    keep_next: bool = False,
) -> str:
    keep = "<w:keepNext/>" if keep_next else ""
    return f"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/>{keep}</w:pPr>{run(text, bold, italic, color)}</w:p>"


def mixed_para(parts: list[tuple[str, dict]], style: str = "Normal") -> str:
    return (
        f"<w:p><w:pPr><w:pStyle w:val=\"{style}\"/></w:pPr>"
        + "".join(run(text, **kwargs) for text, kwargs in parts)
        + "</w:p>"
    )


def page_break() -> str:
    return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'


def cell(content: str, width: int, shade: str | None = None, align: str = "top") -> str:
    fill = f'<w:shd w:fill="{shade}"/>' if shade else ""
    return (
        "<w:tc>"
        f"<w:tcPr><w:tcW w:w=\"{width}\" w:type=\"dxa\"/>"
        f"<w:vAlign w:val=\"{align}\"/>{fill}"
        '<w:tcMar><w:top w:w="80" w:type="dxa"/><w:left w:w="120" w:type="dxa"/>'
        '<w:bottom w:w="80" w:type="dxa"/><w:right w:w="120" w:type="dxa"/></w:tcMar>'
        "</w:tcPr>"
        f"{content}"
        "</w:tc>"
    )


def table(rows: list[list[str]], widths: list[int], header: bool = True) -> str:
    grid = "".join(f'<w:gridCol w:w="{w}"/>' for w in widths)
    out = [
        "<w:tbl>",
        "<w:tblPr>"
        '<w:tblStyle w:val="TableGrid"/>'
        '<w:tblW w:w="9360" w:type="dxa"/>'
        '<w:tblInd w:w="120" w:type="dxa"/>'
        '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="DCE5DF"/>'
        '<w:left w:val="single" w:sz="4" w:color="DCE5DF"/>'
        '<w:bottom w:val="single" w:sz="4" w:color="DCE5DF"/>'
        '<w:right w:val="single" w:sz="4" w:color="DCE5DF"/>'
        '<w:insideH w:val="single" w:sz="4" w:color="DCE5DF"/>'
        '<w:insideV w:val="single" w:sz="4" w:color="DCE5DF"/></w:tblBorders>'
        "</w:tblPr>",
        f"<w:tblGrid>{grid}</w:tblGrid>",
    ]
    for r_index, row in enumerate(rows):
        out.append("<w:tr>")
        for c_index, value in enumerate(row):
            shade = "E8EEF5" if header and r_index == 0 else None
            style = "TableHeader" if header and r_index == 0 else "TableText"
            out.append(cell(para(value, style=style, bold=(header and r_index == 0)), widths[c_index], shade))
        out.append("</w:tr>")
    out.append("</w:tbl>")
    return "".join(out) + para("", "Tiny")


def code_block(text: str, title: str | None = None) -> str:
    lines = []
    if title:
        lines.append(para(title, "DiagramTitle", bold=True))
    for line in dedent(text).strip("\n").splitlines():
        lines.append(para(line.rstrip(), "CodeBlock"))
    return table([["".join(lines)]], [9360], header=False)


def section(title: str, level: int = 1) -> str:
    return para(title, f"Heading{level}", keep_next=True)


def doc_xml(body: str) -> str:
    return (
        f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        f"<w:document {NS}><w:body>{body}"
        '<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr>'
        "</w:body></w:document>"
    )


def styles_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/><w:qFormat/>
    <w:pPr><w:spacing w:after="120" w:line="300" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/><w:color w:val="24342B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:qFormat/>
    <w:pPr><w:spacing w:before="0" w:after="160"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="48"/><w:color w:val="17351F"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:qFormat/>
    <w:pPr><w:spacing w:after="240" w:line="300" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="24"/><w:color w:val="64736A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="Heading 1"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="360" w:after="200"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="32"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="Heading 2"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="280" w:after="140"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="26"/><w:color w:val="2E74B5"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="Heading 3"/><w:qFormat/>
    <w:pPr><w:keepNext/><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="24"/><w:color w:val="1F4D78"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableText"><w:name w:val="Table Text"/>
    <w:pPr><w:spacing w:after="40" w:line="280" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="18"/><w:color w:val="24342B"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="TableHeader"><w:name w:val="Table Header"/>
    <w:pPr><w:spacing w:after="40" w:line="280" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="18"/><w:color w:val="17351F"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="CodeBlock"><w:name w:val="Code Block"/>
    <w:pPr><w:spacing w:after="20" w:line="260" w:lineRule="auto"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:sz w:val="17"/><w:color w:val="17351F"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="DiagramTitle"><w:name w:val="Diagram Title"/>
    <w:pPr><w:spacing w:after="80"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:b/><w:sz w:val="20"/><w:color w:val="176B3A"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Tiny"><w:name w:val="Tiny"/>
    <w:pPr><w:spacing w:after="60"/></w:pPr>
    <w:rPr><w:sz w:val="4"/></w:rPr>
  </w:style>
</w:styles>"""


def settings_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:settings xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:zoom w:percent="100"/>
  <w:defaultTabStop w:val="720"/>
  <w:characterSpacingControl w:val="doNotCompress"/>
</w:settings>"""


def rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""


def document_rels_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/settings" Target="settings.xml"/>
</Relationships>"""


def content_types_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/settings.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.settings+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
  <Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>"""


def core_xml() -> str:
    now = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    return f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>GLV Management System Documentation</dc:title>
  <dc:creator>Codex</dc:creator>
  <cp:lastModifiedBy>Codex</cp:lastModifiedBy>
  <dcterms:created xsi:type="dcterms:W3CDTF">{now}</dcterms:created>
  <dcterms:modified xsi:type="dcterms:W3CDTF">{now}</dcterms:modified>
</cp:coreProperties>"""


def app_xml() -> str:
    return """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
  <Application>Codex OOXML Builder</Application>
  <DocSecurity>0</DocSecurity>
  <ScaleCrop>false</ScaleCrop>
  <Company>God's Love Ventures</Company>
</Properties>"""


def build_body() -> str:
    generated = datetime.now().strftime("%B %d, %Y")
    body: list[str] = []
    body.append(para("GLV Management System", "Title"))
    body.append(para("Detailed System Documentation and Operator Reference", "Subtitle"))
    body.append(table([
        ["Document", "System documentation"],
        ["Prepared for", "God's Love Ventures / GLV Management System operators"],
        ["Generated", generated],
        ["Workspace", r"C:\Users\andre\glv-management-system"],
        ["Stack", "Next.js 16 App Router, React 19, Auth.js v5, Prisma, Neon Postgres, Tailwind CSS"],
    ], [2200, 7160], header=False))
    body.append(para(
        "This document describes the current GLV Management System as implemented in the repository. It intentionally avoids secrets and shows environment variable names only.",
        "Normal",
        bold=True,
    ))
    body.append(page_break())

    body.append(section("1. Executive Overview"))
    body.append(para("GLV Management System is a business operations application for managing layaway customers, product accounts, installment payments, staff, procurement readiness, credits/refunds, reports, settings, notifications, audit logs, and admin support. The system is built as a server-rendered Next.js App Router application with Prisma-backed persistence in Neon Postgres."))
    body.append(table([
        ["Area", "What it does"],
        ["Customer operations", "Registers customers, assigns staff, creates product accounts, records payments, tracks balances, and keeps customer/account histories together."],
        ["Financial operations", "Records payments, generates receipt numbers, recalculates balances, creates overpayment credits, tracks salaries, and exports weekly Excel reports."],
        ["Procurement operations", "Shows products that should be bought when linked accounts reach at least 70% paid, including fully paid but undelivered accounts."],
        ["Staff operations", "Manages staff records, applications, salaries, permissions, login accounts, password reset, and staff-specific dashboards."],
        ["Control and governance", "Uses role/permission gates, audit logs, admin confirmations, settings, lifecycle rules, and protected server actions."],
    ], [2100, 7260]))

    body.append(section("2. High-Level Architecture"))
    body.append(code_block("""
    User Browser
       |
       v
    Next.js App Router pages and layouts
       |
       +--> Server Components read Prisma data for pages
       +--> Server Actions mutate customers, accounts, payments, products, staff, settings
       +--> Route Handlers expose auth, notifications, weekly export, health, AI support
       |
       v
    Auth.js v5 session and route authorization
       |
       v
    Prisma Client / Neon Postgres
       |
       +--> AuditLog records important business changes
       +--> Weekly Excel export composes data with ExcelJS
       +--> AI Support route optionally calls OpenAI when configured
    """, "Diagram 1: System Architecture"))
    body.append(table([
        ["Layer", "Key files", "Responsibility"],
        ["Presentation shell", "app/layout.tsx, components/app-shell.tsx, components/dashboard-nav.tsx", "Protected layout, sidebar navigation, role-specific menu visibility, notification badges, admin AI support bubble."],
        ["Pages", "app/**/page.tsx", "Server-rendered module screens for dashboard, customers, accounts, payments, products, staff, reports, settings, activity, credits, and audit logs."],
        ["Mutations", "actions/*.ts", "Server Actions for authenticated business writes and audit logging."],
        ["Domain services", "lib/*.ts", "Shared business logic for auth config, reports, lifecycle, procurement, account creation, payment recording, settings, permissions, and utilities."],
        ["Persistence", "prisma/schema.prisma, prisma/migrations", "Data model and migration history for Neon Postgres."],
        ["API routes", "app/api/**/route.ts", "Auth route, change-password, logout, notifications, weekly export, system health, and AI support."],
    ], [1900, 3100, 4360]))

    body.append(section("3. Data Model and Relationships"))
    body.append(code_block("""
    Staff 1 ───< Customer 1 ───< CustomerAccount >─── 1 Product
                                  |
                                  +──< Payment
                                  |
                                  +──< CustomerCredit

    Staff 1 ─── 0..1 User
    Staff 1 ───< StaffSalaryPayment
    Customer 1 ───< CustomerCredit
    User / system actions ───< AuditLog
    Setting stores singleton-like business configuration
    StaffApplication stores pending signup requests before staff/user creation
    """, "Diagram 2: Entity Relationship Overview"))
    body.append(table([
        ["Model", "Purpose", "Important fields"],
        ["User", "Login identity and role/permission carrier.", "email, password, role, staffId, permissions, mustChangePassword, online, lastSeenAt"],
        ["Staff", "Employee profile connected to customers, salaries, and optional user.", "code, fullName, email, phone, active, monthlySalary"],
        ["StaffApplication", "Public staff signup request awaiting admin review.", "fullName, email, phone, status, reviewedBy, reviewedAt"],
        ["Customer", "Person buying products through layaway.", "customerId, fullName, phone, address, nationalId, staffId"],
        ["Product", "Sellable product or combo.", "name, category, costPrice, transportCost, layawayPrice, dailyAmount, duration, quantityOnSale, active"],
        ["CustomerAccount", "A customer's product layaway contract.", "targetAmount, dailyAmount, totalPaid, balance, status, deliveryStatus, deliveredAt"],
        ["Payment", "Installment payment record with generated receipt.", "receiptNo, accountId, amount, paymentDate, method, receivedBy"],
        ["CustomerCredit", "Overpayment or closure refund credit.", "amount, remainingAmount, status, source, accountId, paymentId"],
        ["StaffSalaryPayment", "Payroll payment tracking.", "staffId, amount, paymentDate, notes, paidBy"],
        ["AuditLog", "Immutable-style activity history for key changes.", "userId, action, entity, entityId, oldValue, newValue"],
        ["Setting", "Company, layaway, payroll, security, notification, theme, and system configuration.", "companyName, thresholds, prefixes, payrollDay, permissions-related defaults, status fields"],
    ], [1700, 3300, 4360]))

    body.append(section("4. Roles, Permissions, and Authentication"))
    body.append(para("Authentication uses Auth.js v5 credentials flow. Route authorization is centralized in the Auth.js authorized callback. Users with mustChangePassword are redirected to /change-password until they complete the first-login reset. Staff are limited to operational routes unless granted explicit permissions."))
    body.append(table([
        ["Role / permission", "Access pattern"],
        ["SUPER_ADMIN", "Full administrative role. Treated as admin throughout the UI and server checks."],
        ["ADMIN", "Administrative access, including settings and privileged modules."],
        ["STAFF", "Operational access to dashboard, activity, assigned customers/accounts/payments, and change-password."],
        ["MANAGE_CUSTOMERS", "Allows broader customer management beyond assigned staff ownership."],
        ["MANAGE_ACCOUNTS", "Allows account creation/correction/delivery operations beyond assigned ownership."],
        ["MANAGE_PAYMENTS", "Allows payment management, credits/refunds, and privileged payment workflows."],
        ["VIEW_REPORTS", "Allows access to reports and weekly export."],
        ["MANAGE_PRODUCTS", "Allows product catalog and procurement module access."],
        ["MANAGE_STAFF", "Allows staff records, applications, salaries, and password resets."],
        ["VIEW_AUDIT_LOGS", "Allows read-only audit log access."],
    ], [2300, 7060]))
    body.append(code_block("""
    Login
      |
      v
    Auth.js credentials provider validates user
      |
      v
    JWT callback stores id, role, permissions, staffId, mustChangePassword
      |
      v
    Authorized callback checks route
      |
      +--> no session: redirect to /login
      +--> must change password: redirect to /change-password
      +--> staff without permission: redirect to /dashboard
      +--> allowed: render protected route
    """, "Diagram 3: Authentication and Authorization Flow"))

    body.append(section("5. Module Catalog"))
    body.append(table([
        ["Module", "Route(s)", "What it does"],
        ["Public Home", "/", "Landing/public entry point for GLV."],
        ["Login", "/login", "Credentials login with Auth.js server action integration."],
        ["Forgot Password", "/forgot-password", "Password reset request UI."],
        ["Signup", "/signup", "Staff application submission before admin approval."],
        ["Change Password", "/change-password, /api/change-password", "First-login or forced password change; clears stale auth cookies after success."],
        ["Dashboard", "/dashboard", "Role-shaped summary: admins see business KPIs; staff see assigned operational metrics."],
        ["Activity", "/activity", "Operational activity and collection trends."],
        ["Customers", "/customers, /customers/new, /customers/[id], /customers/[id]/edit", "Customer CRUD, search/filtering, assignment, profile, account/payment history, and customer-level actions."],
        ["Accounts", "/accounts, /accounts/new, /accounts/[id]", "Product account creation, status, balance, delivery status, payment entry, corrections, and lifecycle handling."],
        ["Payments", "/payments, /payments/new", "Payment recording, receipt numbers, grouped history, deletion/recalculation, and staff-safe filtering."],
        ["Products", "/products, /products/new, /products/[id], /products/[id]/edit", "Catalog management, product economics, quantity on sale, category badges, and procurement tab."],
        ["Procurement", "/products?tab=procurement", "Readiness list for products with accounts at least 70% paid and still pending delivery."],
        ["Staff", "/staff, /staff/new, /staff/[id], /staff/[id]/edit", "Staff records, permissions, assigned work, salary tracking, deactivation, deletion, and password resets."],
        ["Staff Applications", "/staff/applications", "Admin review queue for signup requests."],
        ["Credits & Refunds", "/credits", "Open credits from overpayments or closures and refund tracking."],
        ["Reports", "/reports, /api/reports/weekly-export", "Admin reports, salary tracking, and Excel workbook export including procurement list."],
        ["Audit Logs", "/audit-logs", "Read-only trail of important system actions."],
        ["Settings", "/settings", "Admin control panel for company, layaway, payroll, security, notifications, theme, and system metadata."],
        ["Notifications", "/api/notifications", "Attention counts for modules such as procurement; sidebar clears opened notifications locally."],
        ["AI Support", "/api/support/assistant, components/ai-support-chat.tsx", "Admin-only optional OpenAI support assistant for GLV workflows."],
        ["Health/Logout", "/api/system/health, /api/logout", "Basic health check and logout/cookie cleanup."],
    ], [1700, 2600, 5060]))

    body.append(section("6. Customer, Account, Payment, and Delivery Flow"))
    body.append(code_block("""
    Create customer
      |
      +--> assign staff and generate customer ID
      |
      v
    Create product account
      |
      +--> product sets target amount, daily amount, duration, expected end date
      |
      v
    Record installment payment
      |
      +--> generate receipt
      +--> increase totalPaid
      +--> reduce balance
      +--> complete account when balance reaches zero
      +--> create CustomerCredit for overpayment
      +--> write AuditLog
      |
      v
    Confirm delivery after account is completed
      |
      +--> deliveryStatus becomes DELIVERED
      +--> procurement list quantity decreases or clears
    """, "Diagram 4: Customer Account Lifecycle"))
    body.append(table([
        ["Flow step", "Server code", "Key controls"],
        ["Create customer", "actions/customers.ts", "Duplicate warning, staff assignment, permission/ownership checks, audit log."],
        ["Create account", "actions/accounts.ts, lib/customer-account-creation.ts", "Uses selected product economics, creates expected end date and opening balance."],
        ["Record payment", "actions/payments.ts, lib/payment-recording.ts", "Rejects closed/suspended/cancelled/completed accounts, generates receipt, updates balance/status, creates overpayment credit."],
        ["Delete payment", "actions/payments.ts", "Recalculates account totals and balance; restricted to permitted users."],
        ["Correct account price/product", "actions/accounts.ts", "Admin password confirmation, recalculates balances, can create credit when product/price drops below paid amount."],
        ["Confirm delivery", "actions/accounts.ts", "Only after account is completed and balance is zero; revalidates account/customer/product screens."],
    ], [2200, 3100, 4060]))

    body.append(section("7. Product and Procurement Module"))
    body.append(para("The procurement list is a computed view, not a separate table. It groups pending-delivery customer accounts by product when their payment progress reaches the effective procurement threshold. The current rule is at least 70% paid, including fully paid accounts that are not yet delivered. Once delivery is confirmed, the account stops contributing to procurement quantity."))
    body.append(code_block("""
    CustomerAccount
      |
      +--> status in ACTIVE / COMPLETED / OVERDUE / DORMANT / PROBATION
      +--> deliveryStatus is PENDING
      +--> totalPaid / targetAmount >= 70%
      |
      v
    Group by Product
      |
      +--> quantity = eligible accounts count
      +--> totalCost = quantity * (costPrice + transportCost)
      +--> averageProgress and highestProgress displayed
      |
      v
    Products procurement tab + sidebar notification + weekly report sheet
      |
      v
    Confirm delivery
      |
      +--> remove or reduce product from procurement list
    """, "Diagram 5: Procurement Readiness Flow"))
    body.append(table([
        ["Procurement field", "Meaning"],
        ["Products to buy", "Number of product groups with at least one eligible pending-delivery account."],
        ["Total units", "Total eligible pending-delivery accounts across all products."],
        ["Estimated total cost", "Sum of landed product cost for all units to buy."],
        ["Average paid", "Average payment progress across eligible accounts for that product."],
        ["Highest paid", "Highest payment progress across eligible accounts, used for sorting."],
        ["Clearing rule", "Delivery confirmation changes deliveryStatus to DELIVERED; the account is excluded from procurement."],
    ], [2300, 7060]))

    body.append(section("8. Staff, Applications, Salary, and Password Management"))
    body.append(para("Staff can enter through an application workflow or be created directly by an admin. Approved staff can receive a user account, staff code, permissions, and a temporary/reset password. Salary tracking records monthly salary obligations and salary payments for reports."))
    body.append(code_block("""
    Public signup
      |
      v
    StaffApplication PENDING
      |
      +--> Admin approves: create Staff + optional User + audit log
      |
      +--> Admin rejects: mark REJECTED + audit log
      |
      v
    Staff profile
      |
      +--> assigned customers/accounts/payments
      +--> monthly salary and salary payments
      +--> password reset and permission edits
    """, "Diagram 6: Staff Application and Management Flow"))
    body.append(table([
        ["Capability", "Details"],
        ["Staff list/detail", "Shows staff code, contact info, active status, assigned customers, and operational work."],
        ["Applications", "Admin queue for public signup requests with approve/reject outcomes."],
        ["Permissions", "Granular permissions can expand staff access to admin sections without changing role to admin."],
        ["Salary", "Monthly salary stored on Staff; salary payment records support report balances and payroll summaries."],
        ["Password reset", "Admin reset produces temporary credentials and can require password change."],
        ["Deletion/deactivation", "Destructive staff operations are admin-gated and protected by confirmation logic where applicable."],
    ], [2100, 7260]))

    body.append(section("9. Credits, Refunds, Lifecycle, and Closure Rules"))
    body.append(para("Credits are created when a payment overpays an account or when lifecycle closure creates a refund credit after deducting the service fee. Lifecycle refresh checks active-like accounts and moves them toward DORMANT, PROBATION, or CLOSED based on inactivity."))
    body.append(table([
        ["Rule", "Current behavior"],
        ["Dormant", "Account becomes DORMANT after 21 days without payment activity."],
        ["Probation", "Account becomes PROBATION after 4 months without payment activity."],
        ["Closed", "Account becomes CLOSED after 6 months without payment activity."],
        ["Closure refund", "When closing with paid amount and no prior closure credit, 32% service fee is deducted and remaining amount becomes an open credit."],
        ["Overpayment credit", "Payment amount beyond remaining balance creates CustomerCredit linked to the payment/account."],
        ["Refund action", "Credits can be marked refunded by permitted payment/admin users."],
    ], [2400, 6960]))

    body.append(section("10. Reports, Weekly Export, and Activity"))
    body.append(para("Reports combine customer/account/payment/staff/salary data into admin-facing summaries and an Excel workbook. The weekly export refreshes lifecycle statuses first, then builds sheets for executive summary, staff performance, accounts, weekly payment history, product profitability, procurement list, and weekly ledger."))
    body.append(code_block("""
    Report page
      |
      +--> getAdminReportSummary()
      +--> getWeeklyStaffPerformanceReport()
      |
      v
    Weekly export route
      |
      +--> refreshAccountLifecycleStatuses()
      +--> query staff, customers, accounts, payments, salaries, products
      +--> getProcurementList()
      |
      v
    Excel workbook
      |
      +--> Executive Summary
      +--> Staff Performance
      +--> Customer Accounts
      +--> Payment History
      +--> Product Profitability
      +--> Procurement List
      +--> Weekly Ledger
    """, "Diagram 7: Reporting and Export Flow"))
    body.append(table([
        ["Report component", "Purpose"],
        ["Admin report summary", "High-level business metrics, balances, status counts, salaries, collection data."],
        ["Staff performance report", "Ranks staff by collection and assigned account/customer activity."],
        ["Activity report", "Dashboard/activity charts and recent payment/customer/account signals."],
        ["Weekly Excel export", "Downloadable workbook intended for operations review and management reporting."],
        ["Procurement sheet", "Products ready to buy with quantity, costs, layaway price, average paid %, and highest paid %."],
    ], [2400, 6960]))

    body.append(section("11. Notifications and AI Support"))
    body.append(para("Notifications are currently computed attention items, not persisted notification records. The live route checks procurement readiness for users with product-management access. The sidebar badge opens the relevant target and clears that exact notification locally; if the count or label changes later, it can show again."))
    body.append(code_block("""
    AppShell loads protected page
      |
      v
    GET /api/notifications
      |
      +--> if user can manage products, compute procurement list
      |
      v
    Sidebar badge on Products
      |
      +--> click opens /products?tab=procurement
      +--> store local dismissal signature
      +--> hide same badge until count/label changes
    """, "Diagram 8: Notification Clear-on-Open Flow"))
    body.append(table([
        ["Feature", "Implementation"],
        ["Notification source", "app/api/notifications/route.ts"],
        ["Badge rendering", "components/dashboard-nav.tsx"],
        ["Dismissal storage", "components/app-shell.tsx localStorage key glv-dismissed-attention"],
        ["AI support", "Admin-only floating chat bubble; route calls OpenAI only when OPENAI_API_KEY is configured."],
        ["AI support scope", "Navigation, permissions, payments, accounts, products, procurement, staff, reports, settings, and troubleshooting."],
    ], [2300, 7060]))

    body.append(section("12. Settings Module"))
    body.append(para("Settings is the broad admin control panel. It persists company profile, layaway defaults, fees, procurement threshold, payroll defaults, receipt/customer/staff code prefixes, security toggles, notification preferences, theme settings, and system status labels. Some settings are actively consumed; others are stored for future or partial wiring, so operators should distinguish saved configuration from behavior that is actually enforced downstream."))
    body.append(table([
        ["Settings group", "Examples", "Current use"],
        ["Company profile", "companyName, tradingName, tagline, phone, address, tax IDs", "Used for branding and records; visible in shell and settings."],
        ["Layaway rules", "installmentDurationDays, defaultDailyCollection, minimumDeposit", "Used as product/account creation defaults where wired."],
        ["Procurement", "procurementThresholdPercent", "Default and effective procurement readiness floor is 70%."],
        ["Payroll", "defaultMonthlySalary, commission fields, payrollDay", "Salary defaults and reporting support."],
        ["IDs and receipts", "receiptPrefix, customerIdPrefix, staffCodeLength", "Receipt generation and ID/code helper logic."],
        ["Security", "passwordLength, sessionTimeoutMinutes, requirePasswordChange, twoFactorEnabled", "Some fields are stored; password-change enforcement is live through Auth.js/session logic."],
        ["Notifications", "email/sms/WhatsApp toggles", "Stored; current live notification route is procurement attention."],
        ["Appearance/status", "theme, colors, loadingAnimation, currentVersion, databaseStatus", "Stored and partly consumed in UI branding/status surfaces."],
    ], [1900, 3000, 4460]))

    body.append(section("13. Auditability and Data Safety"))
    body.append(para("The system records audit logs for major business writes. Important destructive or financial operations are gated by roles, permissions, staff ownership checks, admin password confirmation, confirmation text, or transaction boundaries. Staff-facing data is shaped server-side so restricted financial totals are not merely hidden in the UI."))
    body.append(table([
        ["Control", "Where it appears"],
        ["Server-side auth", "auth config, page/session checks, server actions"],
        ["Permissions", "UserPermission enum and hasPermission checks"],
        ["Ownership restrictions", "Staff can act on assigned customers/accounts unless broader permission exists"],
        ["Transactions", "Payments, account corrections, staff/customer/product destructive flows, lifecycle closure"],
        ["Audit logs", "Create/update/delete/payment/lifecycle/settings/staff actions"],
        ["Credential safety", "Secrets are environment variables; documentation must never print values."],
    ], [2200, 7160]))

    body.append(section("14. Deployment, Verification, and Operations"))
    body.append(table([
        ["Command", "Purpose", "Current note"],
        ["npm run lint", "ESLint project check.", "Passed in latest verification."],
        ["npx tsc --noEmit", "TypeScript check without emitting files.", "Passed in latest verification."],
        ["npx next build", "Next production build without migration deploy.", "Passed in latest verification."],
        ["npm run build", "Runs prisma migrate deploy, prisma generate, next build.", "Can fail when Neon is unreachable before code build starts."],
        ["npm run db:deploy", "Deploy migrations to database.", "Requires reachable DATABASE_URL."],
        ["npm run seed", "Run Prisma seed script.", "Use only when intentionally bootstrapping data."],
    ], [1900, 3400, 4060]))
    body.append(para("Environment variable names used by the system include DATABASE_URL, AUTH_SECRET, AUTH_URL, OPENAI_API_KEY, and OPENAI_MODEL. Values are intentionally omitted from this document."))

    body.append(section("15. Important Caveats and Known Follow-Ups"))
    body.append(table([
        ["Item", "Current status / recommendation"],
        ["Screenshots", "Live authenticated screenshots were not embedded because the in-app browser connector failed in this Windows session before opening. Diagrams are included instead."],
        ["Settings effectiveness", "Many settings persist today; verify downstream consumers before claiming a setting changes behavior."],
        ["Notification persistence", "Notifications clear locally by signature; there is no database notification/read model yet."],
        ["AI support persistence", "Chat state is browser-local and not audited or stored."],
        ["Prisma package config", "Prisma warns that package.json#prisma is deprecated for Prisma 7; not currently blocking."],
        ["Database reachability", "Full build and migration deploy require Neon connectivity."],
        ["Unstaged local file", "app/page.tsx had an unrelated local edit at the time this documentation was generated; it is not part of the pushed procurement/reporting release."],
    ], [2400, 6960]))

    body.append(section("Appendix A. Source File Map"))
    body.append(table([
        ["Area", "Representative files"],
        ["Pages", "app/dashboard/page.tsx; app/customers/page.tsx; app/accounts/page.tsx; app/payments/page.tsx; app/products/page.tsx; app/staff/page.tsx; app/reports/page.tsx; app/settings/page.tsx"],
        ["Server actions", "actions/customers.ts; actions/accounts.ts; actions/payments.ts; actions/products.ts; actions/staff.ts; actions/settings.ts; actions/salaries.ts; actions/applications.ts"],
        ["Domain libraries", "lib/auth.config.ts; lib/reports.ts; lib/weekly-excel-report.ts; lib/procurement.ts; lib/payment-recording.ts; lib/customer-account-creation.ts; lib/account-lifecycle.ts"],
        ["UI components", "components/app-shell.tsx; components/dashboard-nav.tsx; components/customer-form.tsx; components/account-form.tsx; components/payment-form.tsx; components/product-form.tsx"],
        ["API routes", "app/api/notifications/route.ts; app/api/reports/weekly-export/route.ts; app/api/support/assistant/route.ts; app/api/change-password/route.ts; app/api/system/health/route.ts"],
        ["Data model", "prisma/schema.prisma; prisma/migrations/*"],
    ], [2000, 7360]))
    return "".join(body)


def write_docx() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUT, "w", ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", content_types_xml())
        z.writestr("_rels/.rels", rels_xml())
        z.writestr("docProps/core.xml", core_xml())
        z.writestr("docProps/app.xml", app_xml())
        z.writestr("word/_rels/document.xml.rels", document_rels_xml())
        z.writestr("word/styles.xml", styles_xml())
        z.writestr("word/settings.xml", settings_xml())
        z.writestr("word/document.xml", doc_xml(build_body()))
    print(OUT)


if __name__ == "__main__":
    write_docx()

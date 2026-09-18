import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent / ".docx_deps"))

from PIL import Image
from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SCREENSHOTS = ROOT / "screenshots"
PREPARED = ROOT / "prepared_screenshots"
OUTPUT = ROOT / "GLV_Management_System_Training_and_Feature_Guide.docx"

GREEN = RGBColor(23, 107, 58)
DARK = RGBColor(23, 53, 31)
LIME = RGBColor(183, 235, 85)
MUTED = RGBColor(92, 108, 98)
LIGHT = RGBColor(239, 249, 221)
RED = RGBColor(153, 27, 27)


SECTIONS = [
    ("Business Dashboard", "01-dashboard.png",
     "Provides an executive view of customers, staff, accounts, collections, receivables, product exposure, payroll, refunds, and projected profitability, with a weekly collections trend chart, an account status breakdown chart, and week-over-week up/down indicators on the KPI cards that support them. The Total Customers, Total Staff, New Accounts This Week, and Collected This Week cards (My Customers, Collected Today, and Collected This Week on the staff view) show an animated analog meter: a curved progress arc that sweeps from last week's position to this week's the moment the page loads.",
     "Use it as the daily starting point for assessing business position and identifying areas that need attention. Watch the animated meters: the arc visibly advancing means that figure grew since last week, and it visibly pulling back means it shrank; a small tick mark stays on the track afterward to show exactly where it started. A green up arrow means that figure grew since last week; a red down arrow means it shrank; figures without an arrow or a meter (account status counts, cash position) reflect the current moment rather than a week-over-week change."),
    ("Activity Monitoring", "02-activity.png",
     "Summarises recent customer, account, and payment activity so administrators can see what changed and when.",
     "Use it for operational awareness, follow-up, and quick investigation of newly recorded work."),
    ("Customer Directory", "03-customers.png",
     "Centralises customer records with search, sorting, assignment, account counts, and quick access to customer actions.",
     "Use it to locate customers, review ownership, open profiles, create accounts, and manage assignments."),
    ("Customer Profile", "24-customer-profile.png",
     "Combines customer identity, assigned staff, accounts, payment progress, credits, delivery status, and account actions in one profile.",
     "Use it when assisting a specific customer or reviewing the customer’s complete relationship with GLV."),
    ("Create Customer", "14-create-customer.png",
     "Captures the information required to register a customer and assign responsibility to a staff member.",
     "Use it for onboarding. Required information and access rules help keep customer records consistent."),
    ("Edit Customer", "28-edit-customer.png",
     "Allows authorised users to correct or update customer information without recreating the record.",
     "Use it when contact, address, identity, or assignment information changes."),
    ("Account Management", "04-accounts.png",
     "Lists customer product accounts with balances, progress, lifecycle status, delivery state, filters, and payment shortcuts.",
     "Use it to monitor active agreements, overdue exposure, completed accounts, and account-level actions."),
    ("Account Details", "25-account-details.png",
     "Shows the complete financial and operational history of a single product account, including payments, balance, delivery, credits, and lifecycle controls.",
     "Use it to answer account-specific questions and verify the evidence behind the current balance."),
    ("Create Customer Account", "15-create-account.png",
     "Creates a layaway account by linking a customer to a product and automatically calculating the applicable terms.",
     "Use it for first and additional customer accounts. After creation, the same customer can be carried forward to create another account."),
    ("Payments Ledger", "05-payments.png",
     "Organises recorded collections by staff and customer, with receipt, method, amount, date, credit, search, and filtering information.",
     "Use it to verify collections, locate receipts, review payment history, and investigate recorded amounts."),
    ("Payment Recording Popup", "32-payment-popup.png",
     "Records a payment without leaving the current operational page, reducing repeated page loading during collection entry.",
     "Use it to select an account, enter the amount, date, method, and notes, then confirm the payment and receipt."),
    ("Full Payment Form", "16-record-payment.png",
     "Provides the complete standalone payment-entry workflow for selecting customers and eligible accounts.",
     "Use it when starting payment recording from a general shortcut rather than a specific customer or account."),
    ("Credits and Refunds", "06-credits-refunds.png",
     "Tracks overpayments, closure refunds, remaining credit, and resolution status.",
     "Use it to control money owed back or available to customers and to preserve an auditable refund process."),
    ("Product Catalogue", "07-products-catalog.png",
     "Maintains product pricing, cost, transport, layaway terms, images, profitability, and active status.",
     "Use it to manage the commercial rules that drive customer accounts and profit calculations."),
    ("Product Details", "26-product-details.png",
     "Explains the pricing and profitability of a single product and provides access to its linked operational information.",
     "Use it to validate product economics before selling or procuring additional units."),
    ("Create Product", "17-create-product.png",
     "Captures product cost, pricing, category, image, duration, and daily installment rules.",
     "Use it to introduce a product into the catalogue with consistent financial terms."),
    ("Edit Product", "29-edit-product.png",
     "Allows authorised correction of product descriptions, pricing inputs, images, and operating rules.",
     "Use it when the commercial terms or product presentation changes."),
    ("Procurement Overview", "08-procurement.png",
     "Lists products whose customers are owed more units than the store room currently holds, so it shows only what still has to be bought.",
     "Use it to plan a buying trip from customer commitments and money already collected, then receive the stock so the list reflects what is still outstanding."),
    ("Procurement Details", "31-procurement-details.png",
     "Shows the customer accounts contributing to procurement demand for a selected product, marking each one In stock or To buy.",
     "Use it to validate quantities, collection progress, and the evidence behind a procurement decision. It is a read-only breakdown; receive stock from the Procurement List tab or the Inventory page."),
    ("Inventory", "36-inventory.png",
     "Shows how many units of each product are physically in the store room, how many customers are owed, and how many still have to be bought.",
     "Use it to receive purchased stock, correct a shelf count after a stock take, and check the stock value held."),
    ("Inventory Movements", "37-inventory-movements.png",
     "Lists every change to stock: units received, units delivered to customers, reversals, and corrections, each with the person, the time, the reason and the resulting balance.",
     "Use it to explain any stock figure, investigate a discrepancy, and trace who changed a count and why."),
    ("Staff Management", "09-staff.png",
     "Maintains staff records, roles, permissions, status, customer assignments, inventory, and access-related actions.",
     "Use it to administer the workforce and control what each user can see or manage."),
    ("Staff Profile", "27-staff-profile.png",
     "Combines staff identity, assigned customers, performance information, permissions, and related operational records.",
     "Use it for staff supervision, responsibility reviews, and access-control decisions."),
    ("Create Staff", "18-create-staff.png",
     "Registers a staff profile with the core information needed for assignment and system access.",
     "Use it during onboarding before creating or linking the corresponding user account."),
    ("Edit Staff and Permissions", "30-edit-staff.png",
     "Allows authorised administrators to maintain staff details and operational privileges.",
     "Use it to adjust responsibilities carefully; permission changes affect which modules and actions the staff member can access."),
    ("Financial Intelligence and Reports", "10-reports.png",
     "Combines business performance, weekly staff collections, physical deposits, shortage or surplus, payroll, product profitability, and Excel export.",
     "Use it for weekly control meetings, staff accountability, salary tracking, reconciliation, and management reporting."),
    ("Audit Logs", "11-audit-logs.png",
     "Records important system actions with user, entity, action, and timing information.",
     "Use it to investigate changes, support accountability, and demonstrate operational traceability."),
    ("My Profile", "12-profile.png",
     "Provides personal profile information and controlled requests for sensitive profile changes.",
     "Use it to review account identity, request permitted updates, and access personal security controls."),
    ("Profile Change Approvals", "20-profile-approvals.png",
     "Allows authorised administrators to review pending email and profile-image change requests.",
     "Use it to keep sensitive identity changes controlled rather than immediately self-approved."),
    ("System Settings", "13-settings.png",
     "Centralises company identity, business rules, payroll, notifications, security, appearance, product categories, and data administration, organised as tabs across the top of the page.",
     "Use it for system-wide administration, including addressed Terms and Conditions. Each tab has its own Save button and saves only that tab, so finish one tab before moving to the next. Changes here can affect all users and workflows."),
    ("Weekly Report Import and Recovery", "21-import-recovery.png",
     "Provides a controlled preview-and-import workflow for recovering supported data from exported weekly reports.",
     "Use it only after reviewing the preview and matching recovered records to current staff and products."),
]


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tc_pr.append(shd)


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    run.font.name = "Calibri"
    run.font.size = Pt(9)
    run.font.color.rgb = MUTED
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr_text = OxmlElement("w:instrText")
    instr_text.set(qn("xml:space"), "preserve")
    instr_text.text = "PAGE"
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr_text)
    run._r.append(fld_char2)


def prepare_image(filename):
    PREPARED.mkdir(parents=True, exist_ok=True)
    src = SCREENSHOTS / filename
    dst = PREPARED / filename
    with Image.open(src) as image:
        image = image.convert("RGB")
        width, height = image.size
        max_height = 600
        if height > max_height:
            image = image.crop((0, 0, width, max_height))
        image.save(dst, quality=92)
    return dst


def configure_styles(doc):
    normal = doc.styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = DARK
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.15

    for style_name, size, before, after, color in [
        ("Heading 1", 17, 16, 8, GREEN),
        ("Heading 2", 13, 12, 6, GREEN),
        ("Heading 3", 11.5, 9, 4, DARK),
    ]:
        style = doc.styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = color
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True


def add_feature_page(doc, number, title, filename, description, use):
    doc.add_page_break()
    kicker = doc.add_paragraph()
    kicker.paragraph_format.space_after = Pt(2)
    run = kicker.add_run(f"FEATURE {number:02d}")
    run.bold = True
    run.font.size = Pt(8.5)
    run.font.color.rgb = GREEN

    heading = doc.add_paragraph(title, style="Heading 1")
    heading.paragraph_format.space_before = Pt(0)

    lead = doc.add_paragraph(description)
    lead.paragraph_format.space_after = Pt(5)
    lead.runs[0].font.size = Pt(10.5)

    use_p = doc.add_paragraph()
    use_p.paragraph_format.space_after = Pt(10)
    label = use_p.add_run("How it is used: ")
    label.bold = True
    label.font.color.rgb = GREEN
    use_p.add_run(use)

    image_path = prepare_image(filename)
    image_paragraph = doc.add_paragraph()
    image_paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    image_paragraph.paragraph_format.keep_together = True
    image_paragraph.add_run().add_picture(str(image_path), width=Inches(6.2))

    caption = doc.add_paragraph(f"Figure {number}. {title}")
    caption.alignment = WD_ALIGN_PARAGRAPH.CENTER
    caption.paragraph_format.space_before = Pt(4)
    caption.paragraph_format.space_after = Pt(0)
    for run in caption.runs:
        run.italic = True
        run.font.size = Pt(8.5)
        run.font.color.rgb = MUTED


def build():
    doc = Document()
    section = doc.sections[0]
    section.top_margin = Inches(0.75)
    section.bottom_margin = Inches(0.7)
    section.left_margin = Inches(1.0)
    section.right_margin = Inches(1.0)
    section.header_distance = Inches(0.35)
    section.footer_distance = Inches(0.35)
    configure_styles(doc)

    header = section.header
    header_p = header.paragraphs[0]
    header_p.text = "GLV MANAGEMENT SYSTEM  |  TRAINING AND FEATURE GUIDE"
    header_p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in header_p.runs:
        run.font.name = "Calibri"
        run.font.size = Pt(8)
        run.font.bold = True
        run.font.color.rgb = MUTED

    add_page_number(section.footer.paragraphs[0])

    cover_space = doc.add_paragraph()
    cover_space.paragraph_format.space_after = Pt(58)

    kicker = doc.add_paragraph()
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = kicker.add_run("SYSTEM MANUAL • FEATURE GUIDE • TRAINING RESOURCE")
    run.bold = True
    run.font.size = Pt(9)
    run.font.color.rgb = GREEN

    title = doc.add_paragraph()
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_before = Pt(16)
    title.paragraph_format.space_after = Pt(8)
    title_run = title.add_run("GLV Management System")
    title_run.bold = True
    title_run.font.name = "Calibri"
    title_run.font.size = Pt(30)
    title_run.font.color.rgb = DARK

    subtitle = doc.add_paragraph()
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(28)
    subtitle_run = subtitle.add_run(
        "A visual guide to customer management, installment accounts, "
        "collections, procurement, staff control, reporting, and security"
    )
    subtitle_run.font.size = Pt(14)
    subtitle_run.font.color.rgb = GREEN

    summary_table = doc.add_table(rows=1, cols=3)
    summary_table.autofit = False
    widths = [2.12, 2.12, 2.12]
    labels = [
        ("OPERATIONS", "Customers • Accounts • Payments"),
        ("CONTROL", "Audit • Permissions • Security"),
        ("INTELLIGENCE", "Reports • Deposits • Profitability"),
    ]
    for i, cell in enumerate(summary_table.rows[0].cells):
        cell.width = Inches(widths[i])
        set_cell_shading(cell, "EFF9DD")
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(8)
        p.paragraph_format.space_after = Pt(8)
        r1 = p.add_run(labels[i][0] + "\n")
        r1.bold = True
        r1.font.size = Pt(9)
        r1.font.color.rgb = GREEN
        r2 = p.add_run(labels[i][1])
        r2.font.size = Pt(8.5)
        r2.font.color.rgb = DARK

    prepared = doc.add_paragraph()
    prepared.alignment = WD_ALIGN_PARAGRAPH.CENTER
    prepared.paragraph_format.space_before = Pt(42)
    prepared.add_run("Prepared for God's Love Ventures\n").bold = True
    detail = prepared.add_run("Training, onboarding, demonstrations, and feature communication")
    detail.font.size = Pt(9.5)
    detail.font.color.rgb = MUTED

    doc.add_page_break()
    doc.add_paragraph("How to Use This Guide", style="Heading 1")
    doc.add_paragraph(
        "This guide explains what each major GLV Management System screen does, "
        "how it supports daily operations, and where it fits into management control. "
        "Screenshots were captured from the live system in read-only fashion; no form "
        "was submitted and no business record was created, changed, approved, or deleted."
    )

    note = doc.add_table(rows=1, cols=1)
    note.autofit = False
    note.columns[0].width = Inches(6.5)
    set_cell_shading(note.cell(0, 0), "FFF4E5")
    p = note.cell(0, 0).paragraphs[0]
    p.paragraph_format.space_before = Pt(7)
    p.paragraph_format.space_after = Pt(7)
    rr = p.add_run("Privacy note: ")
    rr.bold = True
    rr.font.color.rgb = RED
    p.add_run(
        "Some screenshots contain live operational names and figures. Before using "
        "this guide in public advertising, replace or anonymise sensitive customer, "
        "staff, receipt, and financial information."
    )

    doc.add_paragraph("Core Business Flow", style="Heading 2")
    doc.add_paragraph(
        "Products define the commercial terms. Staff are assigned customers. Customers "
        "receive one or more product accounts. Payments reduce account balances and create "
        "receipts. Completed accounts move into delivery control. Collections feed reports, "
        "procurement readiness, payroll analysis, deposits, reconciliation, credits, and audits."
    )

    doc.add_paragraph("Guide Contents", style="Heading 2")
    contents = doc.add_table(rows=1, cols=2)
    contents.autofit = False
    contents.columns[0].width = Inches(0.75)
    contents.columns[1].width = Inches(5.75)
    contents.cell(0, 0).text = "No."
    contents.cell(0, 1).text = "Screen / capability"
    set_repeat_table_header(contents.rows[0])
    for cell in contents.rows[0].cells:
        set_cell_shading(cell, "DDEBC0")
        for run in cell.paragraphs[0].runs:
            run.bold = True
            run.font.color.rgb = DARK
    for index, (title, *_rest) in enumerate(SECTIONS, start=1):
        cells = contents.add_row().cells
        cells[0].text = str(index)
        cells[1].text = title
        cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER

    for index, section_data in enumerate(SECTIONS, start=1):
        add_feature_page(doc, index, *section_data)

    doc.add_page_break()
    doc.add_paragraph("Operational Training Notes", style="Heading 1")
    for heading, body in [
        ("Accuracy before speed",
         "Confirm the customer, product account, amount, and payment date before submitting financial information. Use the confirmation summary before final payment recording."),
        ("Use assigned ownership",
         "Customer and account reporting attributes collections to the staff member responsible for the customer. Keep staff assignments current so performance reports remain meaningful."),
        ("Reconcile collections and deposits",
         "Recorded weekly collections represent payments entered for a staff member’s assigned customers. Staff deposits represent money physically deposited into company accounts. A negative variance is a shortage; a positive variance is a surplus."),
        ("Protect administrator access",
         "Use the least privilege necessary. Super administrator and administrator functions include sensitive configuration, deletion, approvals, payroll, deposits, recovery, and access management."),
        ("Preserve the audit trail",
         "Correct records through authorised edit or controlled delete workflows. Avoid informal workarounds that leave financial information outside the system."),
        ("Use exports and backups",
         "Weekly Excel exports support analysis and recovery, while database backups provide broader protection. Exports are useful business records but should not be treated as a full substitute for tested database restoration."),
        ("Issue customer legal documents at the correct stage",
         "A new product account automatically creates addressed Terms and Conditions. Administrators regenerate terms from Settings. Cancellation calculations are available only for closed or cancelled accounts, while reactivation calculations require lifecycle eligibility. Generated documents remain attached to the account for audit and PDF access."),
        ("Use the correct customer communication channel",
         "The system queues only one enabled channel. Legal and document messages prefer email, then WhatsApp, then SMS. Payment receipts prefer WhatsApp, then SMS, then email. If the customer has neither email nor phone, nothing is queued; staff explain the terms verbally and show the in-system receipt and product tracking information."),
        ("Wait for the button to finish saving",
         "Every Save, Record, Approve, Reject, and Delete button shows a brief loading state and disables itself while GLV processes the request. Wait for that state to clear before moving on. Clicking the same button again while it is disabled does not start a second request, so it no longer creates duplicate payments, deposits, or other records."),
        ("Receive stock after every buying trip",
         "Inventory and procurement are one loop. A product reaches the procurement list only when the units its customers are owed are more than the units already in the store room, so anything on that list is genuinely still to buy. After a buying trip, press Receive on the product's row, either on the Procurement List tab or on the Inventory page, and enter how many units you bought. Those units go into stock and the list reduces by exactly that quantity, so a part purchase leaves the rest outstanding instead of clearing the whole product. Receiving stock is not the same as delivering: you still confirm delivery on the customer's account when they receive the product, and that is what takes the unit back off the shelf."),
        ("Keep the shelf count honest",
         "Confirming a delivery reduces stock by one automatically, and reversing a delivery puts it back. If stock shows zero when you confirm a delivery, GLV still records the delivery, because the customer is standing there and must not be turned away, but it warns you that the count did not have the unit. Fix it on the Inventory page using the correct-count action, which asks for the counted figure and a written reason. Every receipt, delivery, reversal and correction is kept in the movement history against your name, so any figure can be explained later."),
        ("Deliver before full payment only for customers who have earned it",
         "Some long-standing customers receive their product before they finish paying. Only an Admin or Super Administrator can do this, from the account page, using Deliver with balance owing. GLV asks for a written reason and an explicit confirmation, and records how much was still owed at the moment of handover. The account stays open: the customer must keep paying until the balance reaches zero, and the outstanding amount stays visible on the accounts list, the customer profile and in reports. An account delivered this way shows a blue delivery badge instead of the green one, so anyone reviewing the records can see at a glance that money is still owed on a product the customer already has. Use this sparingly, for consistent and well-behaved customers, and never as a way to clear a slow-paying account."),
        ("Save one settings tab at a time",
         "Settings is split into tabs: Company, Business Rules, Payroll, Notifications, Security, Appearance, Product Categories, and Data and System. Each tab has its own Save button and saves only the fields on that tab, so changes on one tab are never affected by another. Finish and save the tab you are on before switching. On a brand-new system, save Company Information first, because the company name and phone number are required before anything else can be stored. The System Notes fields on the Data and System tab are labels the operator maintains by hand; editing them records a note and does not change anything about the live database or storage."),
        ("Read the dashboard trend arrows and meters correctly",
         "The Total Customers, Total Staff, New Accounts, and Collected This Week cards on the dashboard show a small arrow comparing this week to last week: a green up arrow is growth, a red down arrow is a decline, and a flat dash means no change. The same cards also show an animated meter that sweeps from last week's position to this week's when the page loads, with a tick mark left behind at last week's position. These week-over-week comparisons only appear on figures that can be safely measured over time; current-status figures such as Active Accounts, Overdue Accounts, and cash position are shown as a plain snapshot number without an arrow or meter because there is no historical status record to compare against."),
    ]:
        doc.add_paragraph(heading, style="Heading 2")
        doc.add_paragraph(body)

    doc.add_paragraph("Automatic SMS notifications", style="Heading 1")
    doc.add_paragraph("Enable SMS Notifications in Settings after configuring BMS Africa. The approved GLV sender is GODS LOVE V. New salary payment records send a staff alert. New product payment plans send one welcome message at their start date. Payments reaching at least 70 percent of the target send one progress message per plan, including payments that jump beyond 70 percent.")
    doc.add_paragraph("Active or overdue plans with an outstanding balance receive a missed-payment reminder after fourteen full days without payment, which is two full weeks, then at most once per further two-week period. A newly entered payment, including a backdated one, restarts the interval. Completed, closed, cancelled, archived, suspended, dormant and probation accounts do not receive missed-payment reminders. The Missed payment template supports staffName, which inserts the assigned staff member's first name. A daily job checks at 09:00 Ghana time; messages are also dispatched after qualifying actions and during signed-in use.")
    doc.add_paragraph("When a staff deposit is recorded for a week, GLV totals each assigned customer's payments from Monday through Sunday across all product accounts. Each customer who paid receives one weekly summary. Customers with no payment receive no summary. The staff, customer and week key prevents duplicates if another deposit is recorded; a pending summary may be refreshed, but an accepted summary is never resent automatically.")
    doc.add_paragraph("The weekly summary comes in two versions and GLV chooses the right one for each customer. A customer's expected weekly amount is the daily amount of every plan they are still paying on, multiplied by seven. If the customer paid that amount or more, GLV sends the encouraging version that congratulates them for meeting the target. If the customer paid less, GLV sends a different, respectful version that states the weekly target, states how much is still short, and asks the customer to contact their staff member to catch up. This means a customer who fell short is never congratulated for a good week. A customer with no plan currently being collected on counts as on target.")
    doc.add_paragraph("Super administrators open Settings > Notifications > Open SMS settings and delivery to reach the dedicated SMS configuration and delivery page. It shows provider, API key status, approved sender, schedule and all the automatic rules; the master switch is saved there. The same page lists the latest 100 messages and retries failures after correcting a phone number, credit balance or provider setup. Accepted means BMS accepted the campaign; verify delivery in BMS campaign history. Unknown outcomes require operator reconciliation before resending. Turning SMS off pauses new alerts and queued delivery. Old welcome and salary events are not backfilled. Restored pending messages are held as Unknown to prevent duplicate sends.")
    doc.add_paragraph("The SMS page also lets super administrators edit six messages: Salary payment, Customer welcome, 70 percent progress, Missed payment, Weekly summary - target met, and Weekly summary - below target. Each editor shows the placeholders allowed for that event and a sample preview. Both weekly messages can show the expected weekly amount; only the below-target message can show the shortfall. Messages must contain text, stay within 612 template characters and use only the listed placeholders. Reset all restores GLV defaults. Saved changes apply only to notifications queued afterward; an already queued message keeps its reviewed wording. Salary messages go only to the staff member on the salary payment. The customer messages go only to the customer on the qualifying account or weekly payment total.")
    doc.add_paragraph("A customer or staff member with no phone number, or with a number GLV cannot read as a valid Ghana number, is skipped completely. No message is queued for them, no message is attempted, and no failed entry appears in the delivery list. So if an expected message is missing, check the phone number on the customer or staff record first rather than looking for a failure to retry. Correct the number and the next qualifying event will queue normally. If a number is removed after a message was already queued, GLV cancels that message instead of trying to send it.")
    doc.add_paragraph("Default message text is branded Rock Frost Group. Staff and customer name placeholders always render only the first name. The BMS handset sender is Rock Frost, which fits the provider's 11-character limit and must remain approved in BMS before it is configured in production.")
    doc.add_paragraph("Server setup requires MNOTIFY_API_KEY, MNOTIFY_SENDER_ID and CRON_SECRET, plus the SMS queue database migration. Deploy migrations explicitly with npm run db:deploy from a trusted operator environment using DATABASE_URL_UNPOOLED before releasing dependent code. Vercel builds do not migrate through the port 6543 transaction pooler. Store secrets only in approved environments. These alerts use a separate SMS queue; existing document and receipt channel preferences remain separate. Provider configuration and live delivery must be verified before describing the feature as operational.")

    doc.add_paragraph("Integrated Business Management", style="Heading 1")
    doc.add_paragraph("Administrators use one Business Management page for People, Payroll, Accounting and Analytics. These sections share GLV staff, customer payment, salary and expense records; they are not separate modules and do not require duplicate setup.")
    doc.add_paragraph("People records leave requests with approve or reject decisions and dated performance reviews scored from one to five. Payroll records salary payments using the existing salary history and sends the existing salary SMS only to the paid staff member. Accounting records operating expenses and builds a cash position from customer collections less salary payments and expenses; staff deposits are reconciliation records and are not counted again as revenue. Analytics shows current month revenue, payroll, expenses, net cash, headcount, leave and performance figures from the same records.")
    doc.add_paragraph("Only administrators can open this page or change its records. Writes are audit logged. Apply migration 20260909183000_integrated_business_management before release. Version 1 application backup and restore does not yet carry the new leave, performance review and expense records, so operators must retain database-level backups and must not rely on an older application backup to recover this data.")

    doc.add_paragraph("Feature Summary for Demonstrations", style="Heading 1")
    doc.add_paragraph(
        "GLV Management System brings customer onboarding, installment account management, "
        "payment collection, receipt tracking, product profitability, procurement readiness, "
        "staff accountability, physical deposit reconciliation, payroll, refunds, audit logs, "
        "security, backups, and recovery into one role-controlled platform."
    )
    doc.add_paragraph(
        "The system is designed for organisations that collect many small installments and "
        "need a reliable way to connect every payment to a customer, account, product, staff "
        "member, receipt, balance, and management report."
    )

    core = doc.core_properties
    core.title = "GLV Management System Training and Feature Guide"
    core.subject = "Visual system documentation, training guide, and feature overview"
    core.author = "God's Love Ventures"
    core.keywords = "GLV, management system, layaway, payments, staff, reports, training"

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    build()

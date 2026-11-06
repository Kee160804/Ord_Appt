from pathlib import Path
from typing import Iterable, Sequence

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "user-guides"
OUTPUT.mkdir(parents=True, exist_ok=True)

NAVIGATION = [
    ("Overview", "Operational totals, recent activity, plan usage, and the quickest view of business performance."),
    ("Primary operations", "Orders for Ordering and Retail businesses, or Appointments for service businesses."),
    ("Catalog", "Products for Ordering and Retail businesses, or Services for appointment businesses."),
    ("Customers", "Search customer records, update contact details and notes, and review activity history."),
    ("Customer Payments and Fulfillment", "Configure customer payment methods, bank accounts, fulfillment rules, and review uploaded receipts."),
    ("Analytics", "Completed or delivered value, activity totals, customer counts, average value, trends, and status breakdowns. Detailed analytics require an eligible plan or live trial."),
    ("Business Tools", "Owner-only tools such as promotions, QR storefront sharing, and appointment provider or department controls."),
    ("Settings", "Owner configuration for business information, hours, team access, subscription billing, storefront design, order operations, and notification preferences."),
    ("View Storefront", "Opens the public customer experience in a separate browser tab."),
]

ROLES = [
    ("Business owner", "Full tenant control. Can configure settings, team access, subscription, payment methods, business tools, storefront, and daily operations."),
    ("Manager or administrator", "Can access the operational and management screens shown for the business, including catalog, customers, payments, and analytics. Owner-only settings remain restricted."),
    ("Staff member", "Primarily works with the business activity screen, such as Orders or Appointments, according to the assigned tenant role and database permissions."),
    ("Storefront customer", "Does not need a dashboard account. Can browse the public storefront, submit an order or booking, verify access to tracking, follow progress, and upload a payment receipt when allowed."),
]

PAYMENT_METHODS = [
    ("Bank transfer", "The customer pays a bank account belonging to the business. Bank details are disclosed only after order or booking tracking is verified. The customer can upload a JPG, PNG, or PDF receipt up to 5 MB."),
    ("Cash on delivery", "The customer pays the business when the order is delivered. Availability depends on the business enabling this method for the relevant module."),
    ("Payment on pickup", "The customer pays the business when collecting the order."),
    ("Payment at appointment", "The customer pays the service business directly at the appointment unless a deposit or full prepayment is required."),
    ("External payment link", "Tracking can display the business's HTTPS payment-provider link. Completing that external payment does not automatically mark the transaction paid."),
]

PLAN_ROWS = [
    ("Beginner", "$9 BZD monthly", "Up to 50 orders or bookings", "Owner only", "Core storefront and operations"),
    ("Pro", "$12 BZD monthly", "Up to 150 activities", "Owner plus 1 included staff member and up to 3 paid staff seats", "Analytics, advanced catalog controls, promotions, branding, deposits, and team management"),
    ("Enterprise", "$15 BZD monthly", "Unlimited activity", "Owner plus 2 included staff members and up to 7 paid staff seats", "All advanced controls and the highest team capacity"),
]


def set_cell_shading(cell, fill: str):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=110, start=120, bottom=110, end=120):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for margin, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = tc_mar.find(qn(f"w:{margin}"))
        if node is None:
            node = OxmlElement(f"w:{margin}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def prevent_table_row_split(row):
    tr_pr = row._tr.get_or_add_trPr()
    cant_split = OxmlElement("w:cantSplit")
    cant_split.set(qn("w:val"), "true")
    tr_pr.append(cant_split)


def set_table_borders(table):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.first_child_found_in("w:tblBorders")
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), "4")
        element.set(qn("w:color"), "D9D9D9")


def keep_with_next(paragraph):
    paragraph.paragraph_format.keep_with_next = True


def add_table(doc: Document, headers: Sequence[str], rows: Sequence[Sequence[str]], widths: Sequence[float] | None = None):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_table_borders(table)
    header = table.rows[0]
    set_repeat_table_header(header)
    prevent_table_row_split(header)
    for index, text in enumerate(headers):
        cell = header.cells[index]
        set_cell_shading(cell, "17365D")
        set_cell_margins(cell)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        paragraph = cell.paragraphs[0]
        paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
        paragraph.paragraph_format.keep_with_next = True
        run = paragraph.add_run(text)
        run.bold = True
        run.font.color.rgb = RGBColor(255, 255, 255)
        run.font.size = Pt(9.5)
    for row_index, values in enumerate(rows):
        row = table.add_row()
        prevent_table_row_split(row)
        cells = row.cells
        for index, text in enumerate(values):
            cell = cells[index]
            set_cell_margins(cell)
            if row_index % 2:
                set_cell_shading(cell, "F3F6FA")
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            paragraph = cell.paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            run = paragraph.add_run(str(text))
            run.font.size = Pt(9.2)
    if widths:
        for row in table.rows:
            for index, width in enumerate(widths):
                row.cells[index].width = Inches(width)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)
    return table


def add_bullets(doc: Document, items: Iterable[str], level: int = 0):
    for item in items:
        paragraph = doc.add_paragraph(style="List Bullet" if level == 0 else "List Bullet 2")
        paragraph.add_run(item)


def add_steps(doc: Document, items: Iterable[str]):
    for item in items:
        paragraph = doc.add_paragraph(style="List Number")
        paragraph.add_run(item)


def add_lead(doc: Document, label: str, text: str):
    paragraph = doc.add_paragraph()
    run = paragraph.add_run(label)
    run.bold = True
    paragraph.add_run(text)
    return paragraph


def add_heading(doc: Document, text: str, level: int = 1):
    paragraph = doc.add_heading(text, level=level)
    keep_with_next(paragraph)
    return paragraph


def configure_document(title: str, subtitle: str, accent: str = "6D28D9"):
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(0.68)
    section.bottom_margin = Inches(0.65)
    section.left_margin = Inches(0.72)
    section.right_margin = Inches(0.72)

    normal = doc.styles["Normal"]
    normal.font.name = "Aptos"
    normal.font.size = Pt(10.7)
    normal.font.color.rgb = RGBColor(32, 41, 56)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.08

    title_style = doc.styles["Title"]
    title_style.font.name = "Aptos Display"
    title_style.font.size = Pt(27)
    title_style.font.bold = True
    title_style.font.color.rgb = RGBColor(0, 0, 0)
    title_style.paragraph_format.space_after = Pt(9)

    for style_name, size, before, after in (
        ("Heading 1", 18, 16, 7),
        ("Heading 2", 13, 11, 5),
        ("Heading 3", 11, 8, 4),
    ):
        style = doc.styles[style_name]
        style.font.name = "Aptos Display"
        style.font.size = Pt(size)
        style.font.bold = True
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    for style_name in ("List Bullet", "List Bullet 2", "List Number"):
        style = doc.styles[style_name]
        style.font.name = "Aptos"
        style.font.size = Pt(10.5)
        style.paragraph_format.space_after = Pt(3)

    title_p = doc.add_paragraph(style="Title")
    title_p.add_run(title)
    subtitle_p = doc.add_paragraph()
    subtitle_p.paragraph_format.space_after = Pt(18)
    run = subtitle_p.add_run(subtitle)
    run.font.size = Pt(13)
    run.font.color.rgb = RGBColor.from_string(accent)
    run.bold = True

    meta = doc.add_paragraph()
    meta.add_run("Audience  ").bold = True
    meta.add_run("Business owners, authorized team members, and storefront customers\n")
    meta.add_run("Platform  ").bold = True
    meta.add_run("YuhBusiness\n")
    meta.add_run("Guide date  ").bold = True
    meta.add_run("November 2026")
    meta.paragraph_format.space_after = Pt(16)

    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.CENTER
    footer_run = footer.add_run(f"YuhBusiness  |  {title}  |  November 2026")
    footer_run.font.name = "Aptos"
    footer_run.font.size = Pt(8)
    footer_run.font.color.rgb = RGBColor(105, 115, 130)
    return doc


def add_front_matter(doc: Document, purpose: str, outcomes: Sequence[str], sections: Sequence[str]):
    add_heading(doc, "About This Guide", 1)
    doc.add_paragraph(purpose)
    add_lead(
        doc,
        "Configuration matters. ",
        "The screens and choices a person sees depend on the business type, the business owner's settings, the user's role, the current subscription or trial, and whether email, storage, payment, and database services have been configured.",
    )
    add_heading(doc, "What You Will Learn", 2)
    add_bullets(doc, outcomes)
    add_heading(doc, "Guide Contents", 2)
    for index, section in enumerate(sections, start=1):
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_after = Pt(2)
        paragraph.add_run(f"{index}. ").bold = True
        paragraph.add_run(section)


def add_common_navigation(doc: Document, primary_label: str, catalog_label: str):
    add_heading(doc, "Dashboard Navigation", 1)
    doc.add_paragraph(
        "After signing in, the left navigation opens the business dashboard. On a mobile device, use the menu button in the top bar. If the account has access to more than one business, use the business switcher before editing records so that work is performed in the intended business."
    )
    rows = []
    for name, use in NAVIGATION:
        adjusted = use.replace("Orders or Appointments", primary_label).replace("Products for Ordering and Retail businesses, or Services for appointment businesses", catalog_label)
        rows.append((name, adjusted))
    add_table(doc, ["Area", "What It Is Used For"], rows, [1.75, 5.1])

    add_heading(doc, "Role Access", 2)
    add_table(doc, ["Person", "Typical Access"], ROLES, [1.65, 5.2])
    add_lead(
        doc,
        "Security boundary. ",
        "A person's dashboard role does not make them a platform administrator. Business data stays scoped to the selected business, and customers never receive dashboard access merely by placing an order or booking.",
    )


def add_common_setup(doc: Document, specific_steps: Sequence[str]):
    add_heading(doc, "Recommended Owner Setup", 1)
    doc.add_paragraph(
        "Complete setup in the order below. The sequence prevents customers from reaching an unfinished catalog, missing payment instructions, or unavailable fulfillment choices."
    )
    add_steps(doc, specific_steps)

    add_heading(doc, "Business Identity and Hours", 2)
    add_bullets(
        doc,
        [
            "Open Settings and choose Business Info to maintain the public business name, description, About text, phone, email, address, and city.",
            "Choose Business Hours and set opening and closing times for every day. Mark closed days explicitly. These hours affect what customers see and can influence availability or ordering rules.",
            "Choose Storefront to manage the storefront URL, logo, cover image, image framing, brand colors, social links, and storefront layout when the active plan includes branding controls.",
            "Open Business Tools and use QR Storefront to generate a QR code that links customers to the storefront.",
        ],
    )


def add_payments(doc: Document, modules: str, appointment: bool = False):
    add_heading(doc, "Customer Payments and Fulfillment", 1)
    doc.add_paragraph(
        f"YuhBusiness coordinates the transaction record, but customer funds are paid directly to the business. The owner configures methods for {modules}. YuhBusiness does not route these customer payments through the platform's Belize Bank subscription merchant account."
    )
    add_table(doc, ["Method", "How It Works"], PAYMENT_METHODS, [1.6, 5.25])
    add_heading(doc, "Owner Payment Setup", 2)
    add_steps(
        doc,
        [
            "Open Customer Payments and Fulfillment, or Settings and then Billing and Payments.",
            f"Enable only the methods the business accepts and assign each enabled method to {modules}.",
            "Enter clear customer instructions. An external provider link must use HTTPS.",
            "If bank transfer is enabled, add at least one active bank account with bank name, account holder, account number, currency, and any special instructions.",
            "Save fulfillment and communication settings, including any pickup, delivery, verification, reservation, or payment-window controls applicable to the business.",
        ],
    )
    add_heading(doc, "Receipt Review", 2)
    add_bullets(
        doc,
        [
            "A receipt upload changes payment status to Awaiting Verification. It is not proof that money settled.",
            "An authorized business user must compare the receipt with the business's own bank records before verifying funds.",
            "The review queue can mark a submission Verified, Rejected, or Resubmission Requested and can retain an audit event.",
            "Payment verification and operational fulfillment are separate. Verifying payment does not automatically complete an order or appointment.",
            "Bank account details and private receipt files are not part of the public catalog. They are disclosed through the verified tracking workflow.",
        ],
    )
    if appointment:
        add_lead(
            doc,
            "Appointment confirmation rule. ",
            "When the selected appointment requires payment before confirmation, record or verify the required amount before using Confirm and Email Customer. Pay-at-appointment workflows can remain unpaid when no prepayment rule applies.",
        )


def add_promotions(doc: Document, target: str):
    add_heading(doc, "Promotions and Discounts", 1)
    doc.add_paragraph(
        "Promotions are owner-managed tools available during a live trial or on a plan that includes storefront promotions. They can be displayed publicly and validated again by the server during checkout."
    )
    add_bullets(
        doc,
        [
            "Open Business Tools and select Promotions.",
            "Create a code and customer-facing name and description.",
            "Choose a percentage or fixed discount and whether it applies to the total or selected items.",
            f"Optionally restrict the offer to selected {target}.",
            "Set optional start and end times and an optional usage limit.",
            "Activate or deactivate the promotion and optionally upload a flyer or copy its share link.",
            "Customers enter the code during checkout. The server validates dates, limits, eligible items, and the final discount instead of trusting a browser calculation.",
        ],
    )


def add_customers_analytics_team(doc: Document, activity_word: str):
    add_heading(doc, "Customers Analytics and Team", 1)
    add_heading(doc, "Customer Records", 2)
    add_bullets(
        doc,
        [
            f"The customer directory is built from {activity_word} and customer records belonging to the business.",
            "Authorized users can search and page through customers, update contact information, add internal notes, and review order or appointment history.",
            "Customer information should be used only for legitimate fulfillment, support, accounting, and privacy operations.",
        ],
    )
    add_heading(doc, "Analytics", 2)
    doc.add_paragraph(
        "Analytics can show completed or delivered value, activity count, unique customers, average value, trends, and status breakdowns. Detailed analytics is a premium feature and is available during a live trial or on an eligible paid plan."
    )
    add_heading(doc, "Team and Access", 2)
    add_bullets(
        doc,
        [
            "Only the business owner manages invitations, roles, active members, and subscription seat capacity from Settings and Team and Access.",
            "Invitations are email-bound, single-use, and time-limited. Pending invitations reserve capacity.",
            "Removing or deactivating a member preserves historical membership records.",
            "The owner should give each person only the access needed for their job and deactivate access promptly when responsibilities change.",
        ],
    )


def add_plans(doc: Document):
    add_heading(doc, "Plans and Feature Availability", 1)
    doc.add_paragraph(
        "Each business has its own subscription. A newly created business receives a 14-day trial with premium workflow access, up to 150 activities, and one staff seat for evaluation. After the trial, access follows the active plan and current paid period."
    )
    add_table(doc, ["Plan", "Price", "Activity", "Team", "Main Scope"], PLAN_ROWS, [1.0, 1.05, 1.15, 2.1, 1.6])
    add_bullets(
        doc,
        [
            "Additional authorized staff seats cost $2 BZD per month each within the plan maximum.",
            "Premium controls include detailed analytics, advanced catalog tools, product variants, booking deposits, storefront branding, the contact form, promotions, and team management.",
            "A cancelled subscription retains access only until the current paid period ends. An expired trial or paid period can block protected operations.",
            "Subscription billing is separate from customer payments to the business.",
        ],
    )


def add_common_operations(doc: Document, checklist: Sequence[str]):
    add_heading(doc, "Daily Operating Checklist", 1)
    add_bullets(doc, checklist)
    add_heading(doc, "Data and Security Practices", 2)
    add_bullets(
        doc,
        [
            "Use a unique account for each team member. Do not share the owner's password.",
            "Confirm the selected business before editing records when the account can switch among multiple businesses.",
            "Treat customer contact details, notes, bank information, and receipt files as private business information.",
            "Verify payment against the business's bank or payment provider; never rely on an uploaded image alone.",
            "Use status changes instead of deleting transactional history. Cancelled and completed records are retained for support, reconciliation, and reporting.",
            "Sign out on shared devices and promptly deactivate team members who no longer need access.",
        ],
    )


def add_troubleshooting(doc: Document, rows: Sequence[Sequence[str]]):
    add_heading(doc, "Troubleshooting", 1)
    common = [
        ("The storefront does not show an item", "Confirm the item is active, its category or department is active, inventory allows sale, the storefront is active, and the applicable module is enabled."),
        ("A premium control is locked", "Check whether the trial is still live or the current paid plan includes that feature. Also confirm the paid period has not expired."),
        ("A team member cannot see a screen", "Confirm the person is active in the correct business and has the appropriate role or permission. Owner-only tools cannot be opened by staff."),
        ("A customer did not receive email", "Confirm the email address, email preferences, sender configuration, and worker configuration. Use tracking or direct contact while delivery is investigated."),
        ("Payment says awaiting verification", "Review the receipt against the business's bank records. Uploading a receipt never verifies funds automatically."),
    ]
    add_table(doc, ["Situation", "What to Check"], common + list(rows), [2.0, 4.85])


def save(doc: Document, filename: str):
    path = OUTPUT / filename
    doc.save(path)
    return path


def build_ordering_guide():
    title = "Ordering Business User Guide"
    doc = configure_document(title, "How owners staff and storefront customers use food and service ordering", "6D28D9")
    sections = [
        "Understanding the Ordering Business",
        "Dashboard Navigation",
        "Recommended Owner Setup",
        "Product and Menu Management",
        "Order Operations Configuration",
        "Storefront Customer Ordering",
        "Managing Orders",
        "Customer Payments and Fulfillment",
        "Promotions and Discounts",
        "Customers Analytics and Team",
        "Plans and Feature Availability",
        "Daily Operating Checklist",
        "Troubleshooting",
    ]
    add_front_matter(
        doc,
        "This guide explains the Ordering business experience for restaurants, bakeries, cafes, food trucks, and other businesses that accept prepared-item orders. It covers setup, menu management, dine-in, pickup and delivery checkout, order processing, customer tracking, direct business payments, and team responsibilities.",
        [
            "Configure the ordering storefront before accepting customer orders.",
            "Create products, categories, add-ons, inventory rules, promotions, and fulfillment choices.",
            "Understand exactly what a storefront customer sees from browsing through tracking.",
            "Move orders through the correct operational statuses and communicate with customers.",
            "Separate customer payments from the business's YuhBusiness subscription.",
        ],
        sections,
    )

    overview_heading = add_heading(doc, "Understanding the Ordering Business", 1)
    overview_heading.paragraph_format.page_break_before = True
    doc.add_paragraph(
        "An Ordering business publishes a food or prepared-item menu. Customers browse categories, search the catalog, configure add-ons, select quantities, and submit dine-in, pickup, or delivery orders. The business manages the menu and converts each submitted order from a pending request into a fulfilled or cancelled record."
    )
    add_table(
        doc,
        ["Part", "Purpose"],
        [
            ("Public storefront", "Customer-facing menu, cart, promotions, checkout, confirmation, and Track Order experience."),
            ("Business dashboard", "Private workspace for menu, orders, customers, payments, analytics, tools, and settings."),
            ("Order record", "The official server-calculated list of items, prices, taxes, discounts, fees, customer details, payment state, and fulfillment state."),
            ("Tracking", "Email-verified customer access to order details, payment instructions, receipt upload, and progress."),
        ],
        [1.55, 5.3],
    )
    add_common_navigation(doc, "Orders", "Products for building and maintaining the menu")
    add_common_setup(
        doc,
        [
            "Complete Settings under Business Info and Business Hours.",
            "Open Products and create categories before building the menu.",
            "Create each product with price, description, image, category, availability, optional stock tracking, and optional add-ons.",
            "Open Settings and Order Operations to enable online ordering and configure order types, tax, minimum order, fees, discounts, preparation time, ordering hours, and delivery areas.",
            "Open Customer Payments and Fulfillment and configure the methods customers can use for Ordering.",
            "Open Business Tools to create promotions and generate the storefront QR code.",
            "Open View Storefront and complete a test order for every enabled order type before publishing the link.",
        ],
    )

    add_heading(doc, "Product and Menu Management", 1)
    doc.add_paragraph(
        "Open Products to build the menu. Search and filtering operate against the business catalog. Categories control how products are grouped on the storefront."
    )
    add_heading(doc, "Creating a Menu Item", 2)
    add_steps(
        doc,
        [
            "Select Add Product.",
            "Enter a clear product name, base price, description, and category.",
            "Add an image by upload or URL. Use a square or landscape image with the item centered.",
            "Enable stock tracking when the business needs a numeric quantity limit. Enter the units currently available.",
            "Add options such as extra cheese, sauces, sides, or toppings. Each add-on can have its own price.",
            "Review the preview, save the product, and confirm it appears in the correct storefront category.",
        ],
    )
    add_heading(doc, "Availability and Inventory", 2)
    add_bullets(
        doc,
        [
            "An inactive product is hidden from customers without deleting its history.",
            "When inventory tracking is enabled, checkout prevents quantities beyond available stock.",
            "Order creation, inventory reduction, promotion redemption, and totals are committed together so a failed order does not leave partial stock changes.",
            "Removing an item should be used carefully because historical order lines retain their own product name and price for recordkeeping.",
        ],
    )

    add_heading(doc, "Order Operations Configuration", 1)
    add_table(
        doc,
        ["Setting", "Effect"],
        [
            ("Accept online orders", "Controls whether customers can submit new orders."),
            ("Temporarily pause orders", "Keeps the storefront visible but disables checkout while the business is busy or closed."),
            ("Order types", "Makes Dine In, Pickup, and Delivery available according to the business workflow."),
            ("Tax rate", "Adds the configured percentage to the server-calculated order total."),
            ("Minimum order", "Rejects checkout below the required subtotal or total rule."),
            ("Delivery fee", "Adds a fee when Delivery is selected."),
            ("Automatic threshold discount", "Applies the configured rate when the qualifying threshold is reached and the owner has enabled it."),
            ("Preparation minutes", "Defines the minimum lead time shown for pickup scheduling."),
            ("Ordering opens and closes", "Limits the configured ordering window."),
            ("Delivery areas", "Provides the approved list customers can choose during delivery checkout."),
        ],
        [1.75, 5.1],
    )

    add_heading(doc, "Storefront Customer Ordering", 1)
    add_heading(doc, "Browsing and Cart", 2)
    add_steps(
        doc,
        [
            "Open the business storefront using its link or QR code.",
            "Use search or a category to find food and drink items.",
            "Open an item, choose add-ons, select quantity, and add the configured line to the cart.",
            "Review each cart line. The same product with different add-ons remains a separate line.",
            "Choose Dine In, Pickup, or Delivery from the order types enabled by the business.",
            "Apply an eligible promotion code and review subtotal, tax, delivery fee, automatic discount, promotion discount, and total.",
            "Proceed to checkout and provide customer and fulfillment information.",
        ],
    )
    add_heading(doc, "Fulfillment Information", 2)
    add_table(
        doc,
        ["Order Type", "Customer Information"],
        [
            ("Dine In", "Table number plus optional order notes such as allergies or preparation requests."),
            ("Pickup", "Requested pickup date and time that respects the configured preparation lead time."),
            ("Delivery", "Delivery address, delivery area, optional directions, and order notes."),
        ],
        [1.45, 5.4],
    )
    doc.add_paragraph(
        "Checkout requires the customer's full name, email address, and phone number. The server loads current product prices, add-ons, tax, discounts, fees, minimums, and inventory before creating the order. A manipulated browser total cannot become the official order total."
    )
    add_heading(doc, "Confirmation and Tracking", 2)
    add_steps(
        doc,
        [
            "Save the order reference shown after checkout. The downloadable order record is not an official payment receipt.",
            "Choose Go to Track Order or open the Track Order storefront tab.",
            "Enter the order reference. A six-digit verification code is sent to the checkout email on file.",
            "Enter the code before it expires. Verified tracking access lasts for the protected session and is scoped to that order.",
            "Review order details, payment instructions, receipt status, and order progress.",
            "For bank transfer, select the business account, use the order reference as the memo, and upload the receipt for review.",
        ],
    )

    add_heading(doc, "Managing Orders", 1)
    doc.add_paragraph(
        "Open Orders to search by reference or customer information, filter by status, page through history, inspect items and totals, and update fulfillment. Orders are retained rather than permanently deleted."
    )
    add_table(
        doc,
        ["Status", "Operational Meaning"],
        [
            ("Pending", "The order was submitted and awaits business review."),
            ("Confirmed", "The business accepted the order."),
            ("Preparing", "The business is actively preparing the order."),
            ("Ready", "The order is ready for pickup, service, or the next handoff. For Ordering businesses this action sends the ready notification when email is configured."),
            ("Delivered", "The order has reached the customer and is treated as fulfilled."),
            ("Cancelled", "The order will not be fulfilled. Cancellation retains the record and can notify the customer."),
        ],
        [1.3, 5.55],
    )
    add_lead(
        doc,
        "Status and payment are separate. ",
        "An order can be operationally ready while payment is still unpaid or awaiting verification. Confirm money independently when the chosen method requires verification."
    )
    add_payments(doc, "Ordering")
    add_promotions(doc, "products")
    add_customers_analytics_team(doc, "orders")
    add_plans(doc)
    add_common_operations(
        doc,
        [
            "Check new and pending orders at the start of the shift and throughout service.",
            "Review customer notes, allergies, order type, requested time, and payment method before confirming.",
            "Update inventory and product availability when items sell out or return to stock.",
            "Move orders through statuses promptly so customer tracking is accurate.",
            "Review uploaded bank receipts against the bank record before marking funds received.",
            "Pause online orders when the kitchen cannot accept additional work, then resume when ready.",
            "Review notifications, failed email delivery indicators, and customer messages.",
        ],
    )
    add_troubleshooting(
        doc,
        [
            ("Checkout says Ordering Paused", "Open Settings and Order Operations and turn off Temporarily Pause Orders when the business is ready."),
            ("Pickup time is rejected", "Choose a future time that allows the configured preparation minutes and falls within the ordering window."),
            ("Delivery is unavailable", "Enable Delivery, add applicable delivery settings, and confirm a delivery payment method is assigned to Ordering."),
            ("The total differs from the cart preview", "The server is authoritative and may have applied current prices, stock, tax, fees, minimums, or promotion eligibility."),
        ],
    )
    return save(doc, "YuhBusiness_Ordering_Business_User_Guide.docx")


def build_retail_guide():
    title = "Retail Business User Guide"
    doc = configure_document(title, "How owners staff and storefront customers use retail catalog inventory checkout and tracking", "0F766E")
    sections = [
        "Understanding the Retail Business",
        "Dashboard Navigation",
        "Recommended Owner Setup",
        "Retail Catalog Management",
        "Variants and Inventory",
        "Storefront Customer Purchase",
        "Retail Reservations and Payment Windows",
        "Managing Retail Orders",
        "Customer Payments and Fulfillment",
        "Promotions and Discounts",
        "Customers Analytics and Team",
        "Plans and Feature Availability",
        "Daily Operating Checklist",
        "Troubleshooting",
    ]
    add_front_matter(
        doc,
        "This guide explains the Retail business experience for clothing, footwear, gift, accessory, and other product-based stores. It covers catalog and variant setup, inventory, customer checkout, bank-transfer reservations, payment review, fulfillment, tracking, and owner operations.",
        [
            "Build a retail catalog with categories, images, stock, sizes, colors, SKUs, and price overrides.",
            "Understand what happens when a customer reserves low-stock merchandise for payment.",
            "Configure pickup, delivery, bank transfer, and other business-managed payment choices.",
            "Process payment evidence and move orders through retail fulfillment statuses.",
            "Explain the storefront and Track Order workflow to customers.",
        ],
        sections,
    )
    overview_heading = add_heading(doc, "Understanding the Retail Business", 1)
    overview_heading.paragraph_format.page_break_before = True
    doc.add_paragraph(
        "A Retail business publishes physical products that may have stock, sizes, colors, styles, SKUs, and variant-specific pricing. Customers browse Products and Retail, select the exact variation, add items to a bag, choose pickup or delivery when configured, and follow the purchase through verified tracking."
    )
    add_table(
        doc,
        ["Part", "Purpose"],
        [
            ("Public storefront", "Customer-facing retail catalog, bag, checkout, promotions, confirmation, and tracking."),
            ("Product and variant record", "Defines the sellable item, base price, category, images, stock behavior, and exact size or color variations."),
            ("Reservation", "Temporarily holds inventory while a bank-transfer customer verifies tracking and submits payment evidence."),
            ("Business dashboard", "Manages products, orders, customer payments, fulfillment, customers, analytics, and storefront controls."),
        ],
        [1.55, 5.3],
    )
    add_common_navigation(doc, "Orders", "Products for catalog, inventory, options, and variants")
    add_common_setup(
        doc,
        [
            "Complete Settings under Business Info and Business Hours.",
            "Open Products and create retail categories.",
            "Create products with base details, inventory, images, and any required size or color variants.",
            "Open Settings and Order Operations to enable orders and configure taxes, minimums, delivery fees, discounts, timing, and delivery areas.",
            "Open Customer Payments and Fulfillment and configure Retail methods, bank accounts, pickup and delivery options, reservation behavior, verification time, and payment window.",
            "Create promotions and the storefront QR code from Business Tools.",
            "Use View Storefront to test an in-stock product, a variant, pickup, delivery, tracking verification, and receipt upload.",
        ],
    )

    add_heading(doc, "Retail Catalog Management", 1)
    add_heading(doc, "Creating a Product", 2)
    add_steps(
        doc,
        [
            "Open Products and select Add Product.",
            "Enter the product name, base price, category, and customer-facing description.",
            "Choose whether to track inventory and enter current stock when the product has one shared stock count.",
            "Upload a product image or provide an image URL and verify the preview.",
            "If the item has selectable sizes, colors, or styles, configure product options and variants before saving.",
            "Save and confirm that the correct product and available variants appear on the public storefront.",
        ],
    )
    add_heading(doc, "Categories and Visibility", 2)
    add_bullets(
        doc,
        [
            "Categories group products and control storefront browsing order.",
            "Deactivate a product to remove it from the storefront without losing its record.",
            "A sold-out base product or unavailable variant cannot be added beyond its inventory limit.",
            "Search covers product names and descriptions, while category filters narrow the visible catalog.",
        ],
    )

    add_heading(doc, "Variants and Inventory", 1)
    doc.add_paragraph(
        "Product variants are premium catalog controls available during a live trial or on an eligible plan. They allow one product page to represent exact combinations such as size and color."
    )
    add_table(
        doc,
        ["Variant Field", "Use"],
        [
            ("Size", "Creates choices such as S, M, L or numeric footwear sizes."),
            ("Color or style", "Lets the customer choose the visual or style option associated with a size."),
            ("SKU", "Stores the business's internal stock identifier for the exact variation."),
            ("Variant stock", "Limits checkout to units available for the selected variation."),
            ("Price override", "Replaces the base price for a specific variant when it costs more or less."),
            ("Active state", "Makes a size or variation selectable without deleting its historical record."),
        ],
        [1.45, 5.4],
    )
    add_bullets(
        doc,
        [
            "Use distinct SKUs whenever practical so staff can match the digital order to the physical item.",
            "Update stock immediately after offline sales, returns, damage, or manual adjustments.",
            "The customer must choose a valid, active combination before adding a variant product to the bag.",
            "The server rechecks variant identity, price, and stock during checkout.",
        ],
    )

    add_heading(doc, "Storefront Customer Purchase", 1)
    add_steps(
        doc,
        [
            "Open the retail storefront and browse Products and Retail.",
            "Use search and categories to find a product.",
            "Open the product, choose the available size, color, or style, select a quantity, and add it to the bag.",
            "Review all lines and confirm that each variant label is correct.",
            "Choose Pickup or Delivery from the methods the business configured.",
            "Enter customer contact information and the required fulfillment details.",
            "Choose an available payment method, apply an eligible promotion, and review the server-calculated total.",
            "Place the order and save the reference shown on the confirmation screen.",
            "Open Track Order, verify the checkout email with the six-digit code, and follow payment and delivery progress.",
        ],
    )
    add_lead(
        doc,
        "Unofficial download. ",
        "The confirmation download helps the customer retain the order reference and details. It is not proof of payment. Payment status must be confirmed through Track Order or directly by the business."
    )

    add_heading(doc, "Retail Reservations and Payment Windows", 1)
    doc.add_paragraph(
        "Retail bank-transfer checkout can reserve inventory while the customer completes verification and payment. The order and stock deduction occur in one locked database transaction so the same last unit cannot be sold twice through the storefront."
    )
    add_steps(
        doc,
        [
            "The customer places the retail order and receives a reference.",
            "Reserved stock is no longer available to another storefront customer. The final unit may display as Awaiting Purchase.",
            "The customer opens Track Order and requests a verification code sent to the stored checkout email.",
            "After verification, the customer sees the selected business bank account and payment instructions.",
            "The customer transfers the amount and uploads a receipt before the configured deadline.",
            "A submitted receipt freezes reservation expiry while the business reviews it.",
            "The business verifies funds against its own bank records or rejects the receipt with a reason.",
            "Expired or repeatedly failed verification can cancel the pending reservation and release inventory.",
        ],
    )
    add_lead(
        doc,
        "Payment does not finish delivery. ",
        "Verification confirms only the business's payment decision. Staff must still prepare, hand over, or deliver the merchandise and update the operational order status."
    )

    add_heading(doc, "Managing Retail Orders", 1)
    doc.add_paragraph(
        "Open Orders to search and filter the retail order history. Select an order to review items, customer, totals, notes, payment state, and fulfillment progress."
    )
    add_table(
        doc,
        ["Status", "Operational Meaning"],
        [
            ("Pending", "The purchase or reservation awaits business action."),
            ("Confirmed", "The business accepted the order."),
            ("Preparing", "Staff are locating, packing, or preparing the merchandise."),
            ("Ready", "The package is ready for pickup or delivery handoff."),
            ("Out for Delivery", "The retail package has left the business for delivery."),
            ("Delivered", "The customer received the merchandise."),
            ("Cancelled", "The order will not be fulfilled. Reservation cancellation may release held inventory according to the transaction state."),
        ],
        [1.45, 5.4],
    )
    add_lead(
        doc,
        "Retail email timing. ",
        "Retail customer confirmation is tied to the payment workflow. Operational status changes update tracking, while payment confirmation provides the payment-specific customer message when email is configured."
    )
    add_payments(doc, "Retail")
    add_promotions(doc, "products or selected retail items")
    add_customers_analytics_team(doc, "retail orders")
    add_plans(doc)
    add_common_operations(
        doc,
        [
            "Check low stock, sold-out products, and pending reservations before opening the storefront for the day.",
            "Review new orders and verify exact sizes, colors, quantities, fulfillment method, and customer notes.",
            "Reconcile uploaded receipts against the business bank record before approving funds.",
            "Pack and label the exact SKU or variation selected by the customer.",
            "Update order status as the package moves from confirmation through delivery or pickup.",
            "Record stock changes caused by offline sales, returns, exchanges, damage, or restocking.",
            "Monitor reservation deadlines and contact customers only through appropriate business channels.",
        ],
    )
    add_troubleshooting(
        doc,
        [
            ("A variant cannot be selected", "Confirm the size and color combination exists, is active, and has stock. Check that product variants are available under the current plan."),
            ("A product says Awaiting Purchase", "The inventory may be reserved by a pending retail payment. Review pending reservations and their payment windows before changing stock manually."),
            ("Reserved stock did not return", "Check whether a receipt froze expiry, payment was verified, or the reservation has not yet reached its cancellation deadline."),
            ("Delivery does not appear", "Enable the appropriate fulfillment option and assign an eligible Retail payment method. Also review delivery areas and delivery configuration."),
        ],
    )
    return save(doc, "YuhBusiness_Retail_Business_User_Guide.docx")


def build_appointment_guide():
    title = "Appointment Business User Guide"
    doc = configure_document(title, "How owners providers staff and storefront customers use service booking", "7C3AED")
    sections = [
        "Understanding the Appointment Business",
        "Dashboard Navigation",
        "Recommended Owner Setup",
        "Service Management",
        "Departments and Providers",
        "Storefront Customer Booking",
        "Managing Appointments",
        "Deposits and Customer Payments",
        "Tracking Rescheduling and Cancellation",
        "Promotions Reviews and Reminders",
        "Customers Analytics and Team",
        "Plans and Feature Availability",
        "Daily Operating Checklist",
        "Troubleshooting",
    ]
    add_front_matter(
        doc,
        "This guide explains the Appointment business experience for salons, barbershops, clinics, studios, consultants, and other service providers. It covers service setup, departments, provider schedules, public booking, deposits, payment review, reminders, customer tracking, rescheduling, and appointment operations.",
        [
            "Create bookable services with duration, price, category, images, and optional deposit rules.",
            "Organize services into departments and connect providers to the services they perform.",
            "Understand how business hours, provider schedules, existing bookings, and service duration determine available time slots.",
            "Process pending bookings through confirmation, completion, cancellation, or no-show.",
            "Explain payment, receipt upload, Track Booking, rescheduling, and cancellation to customers.",
        ],
        sections,
    )
    overview_heading = add_heading(doc, "Understanding the Appointment Business", 1)
    overview_heading.paragraph_format.page_break_before = True
    doc.add_paragraph(
        "An Appointment business publishes services rather than physical products. Customers choose a service, optional provider, date, available time, payment choice, and contact details. The business reviews the request, confirms eligible appointments, assigns providers when needed, and retains the appointment record through completion, cancellation, or no-show."
    )
    add_table(
        doc,
        ["Part", "Purpose"],
        [
            ("Service", "Defines the customer-facing name, duration, price, description, image, category or department, availability, and deposit rule."),
            ("Department", "Groups related services such as Hair, Barbering, Nails, Massage, or Consultation. It is not a provider or schedule."),
            ("Provider", "Represents a person who performs selected services and has a weekly availability schedule."),
            ("Appointment", "Stores the customer, service, provider, date, time, duration, payment state, notes, and lifecycle status."),
            ("Track Booking", "Email-verified customer access to booking, payment, receipt status, rescheduling, cancellation, and progress."),
        ],
        [1.45, 5.4],
    )
    add_common_navigation(doc, "Appointments", "Services for the bookable service catalog")
    add_common_setup(
        doc,
        [
            "Complete Settings under Business Info and Business Hours.",
            "Open Services and create categories and bookable services with accurate duration and price.",
            "Open Business Tools and create service departments, then assign each service to the appropriate department.",
            "Create provider profiles, assign the services each provider performs, and set weekly availability.",
            "Configure customer payment methods and active bank accounts for Appointments.",
            "Enable deposit rules on services when the live trial or plan includes booking deposits.",
            "Create promotions, configure owner email preferences, and generate the storefront QR code.",
            "Use View Storefront to test a general service, a provider-specific service, a deposit, tracking verification, rescheduling, and cancellation.",
        ],
    )

    add_heading(doc, "Service Management", 1)
    add_steps(
        doc,
        [
            "Open Services and select Add New Service.",
            "Enter the service name, price, duration in minutes, and customer-facing description.",
            "Choose or create a category. Categories are also used by service search and storefront filtering.",
            "Add an image URL or upload an appropriate service image.",
            "If prepayment is required and the plan allows deposits, enable the deposit rule and choose a fixed amount or percentage.",
            "Save the service, confirm it is active, and inspect it through View Storefront.",
        ],
    )
    add_bullets(
        doc,
        [
            "Service duration affects the available slot calculation and the appointment end time.",
            "A fixed deposit cannot exceed the service price. A percentage deposit cannot exceed 100 percent.",
            "Deactivating a service hides it from new customer booking while preserving appointment history.",
            "Use clear categories and descriptions so customers can choose the correct service without contacting the business first.",
        ],
    )

    add_heading(doc, "Departments and Providers", 1)
    add_heading(doc, "Departments", 2)
    doc.add_paragraph(
        "Departments are appointment-specific service groupings. Creating a department does not automatically assign services or providers. Open Business Tools and Departments, then use the dropdown beside each service to assign it."
    )
    add_bullets(
        doc,
        [
            "Assigning a department updates the service's department and its category label.",
            "Unassigned services remain under the general Services category.",
            "A department name must be unique within the business, ignoring capitalization.",
            "Deactivating a department does not delete it or unassign services. Services assigned to an inactive department are hidden from the public storefront until the department is reactivated or the services are reassigned.",
            "Use departments for broad service areas. A person's name belongs under Providers, not Departments.",
        ],
    )
    add_heading(doc, "Providers", 2)
    add_steps(
        doc,
        [
            "Open Business Tools and Providers and add or edit a provider.",
            "Enter the public display name, optional public bio, and calendar color. Email and phone are private optional fields.",
            "Choose every service the provider is qualified to perform.",
            "Set each day as available or unavailable and enter valid start and end times.",
            "Keep the provider active only while they accept appointments.",
        ],
    )
    add_lead(
        doc,
        "Provider selection. ",
        "A customer sees only active providers assigned to the selected service. If eligible providers exist, the customer must choose one before available times are loaded. Owners can also assign or change an eligible provider from the appointment details."
    )

    add_heading(doc, "Storefront Customer Booking", 1)
    add_steps(
        doc,
        [
            "Open the business storefront and browse the service catalog.",
            "Use search or the department filter to find a service.",
            "Open the service details and select Book.",
            "Choose a date. If the service has configured providers, select an eligible provider.",
            "Choose one of the available times returned by the server.",
            "Enter optional concerns or special requests.",
            "Provide full name, email address, and phone number.",
            "Choose deposit or full payment when the service and payment configuration offer those options, then choose an available payment method.",
            "Apply an eligible promotion code, review the summary, and submit the booking request.",
            "Save the appointment reference and use Track Booking to follow confirmation and payment status.",
        ],
    )
    add_heading(doc, "How Availability Is Calculated", 2)
    add_bullets(
        doc,
        [
            "The business and service must be active and accepting bookings.",
            "The date must fall on an open business day and within configured business hours.",
            "The selected service duration must fit before closing time.",
            "When a provider is selected, the provider must be active, assigned to the service, and available during that period.",
            "Existing non-cancelled appointments cannot overlap the proposed time.",
            "The public availability result is advisory until booking submission. The server and database perform the final conflict check.",
        ],
    )

    add_heading(doc, "Managing Appointments", 1)
    doc.add_paragraph(
        "Open Appointments to search by customer name, email, or phone; filter by lifecycle status; page through history; and open appointment details. The detail view includes service, date, time, duration, customer contact details, provider, payment choice, amount recorded, balance, notes, and calendar download."
    )
    add_table(
        doc,
        ["Status", "Operational Meaning"],
        [
            ("Pending", "The customer submitted a request and the business must review payment and availability before confirmation."),
            ("Confirmed", "The business accepted the appointment and can send the confirmation email."),
            ("Completed", "The service was delivered. The record remains in history."),
            ("No Show", "The customer did not attend. The record remains for operations and reporting."),
            ("Cancelled", "The appointment will not occur. Cancellation retains history and can notify the customer."),
        ],
        [1.35, 5.5],
    )
    add_bullets(
        doc,
        [
            "For a pending appointment, Cancel or Confirm and Email Customer is available according to the current payment requirement.",
            "For a confirmed appointment, staff can mark Cancelled, No Show, or Completed.",
            "Owners can assign an active provider who is configured for the selected service.",
            "Download Add to Calendar to create an ICS calendar event using the appointment time and duration.",
            "Completed, cancelled, and no-show appointments are retained as read-only historical records rather than permanently deleted.",
        ],
    )

    add_heading(doc, "Deposits and Customer Payments", 1)
    doc.add_paragraph(
        "Deposit controls are premium features available during a live trial or on an eligible plan. A service can require a fixed amount or a percentage of its price. The customer can be offered deposit-only or full-payment selection according to the active configuration."
    )
    add_payments(doc, "Appointments", appointment=True)
    add_heading(doc, "Recording Appointment Payment", 2)
    add_bullets(
        doc,
        [
            "A bank-transfer customer uploads the receipt through verified Track Booking access.",
            "The owner or authorized manager reviews the submission in Customer Payments and Fulfillment.",
            "For money received directly at the business, an authorized user can record the in-person amount using the appointment payment action.",
            "The appointment detail shows the customer's payment choice, required deposit, amount recorded, and remaining balance.",
            "Verifying a deposit can confirm the received deposit while leaving a remaining balance for later payment.",
        ],
    )

    add_heading(doc, "Tracking Rescheduling and Cancellation", 1)
    add_steps(
        doc,
        [
            "The customer opens Track Booking and enters the appointment reference.",
            "A six-digit verification code is sent to the booking email on file.",
            "After verification, the customer can view booking details, payment state, business instructions, and appointment progress.",
            "For an eligible active booking, the customer can open Reschedule Appointment, choose a date within the allowed future window, and select a server-confirmed available time.",
            "Submitting a new time updates the booking request and notifies the business workflow. The business still controls final operational confirmation.",
            "The customer can cancel an eligible appointment after confirming the cancellation prompt.",
            "Completed, cancelled, and no-show appointments cannot be rescheduled through this workflow.",
        ],
    )

    add_heading(doc, "Promotions Reviews and Reminders", 1)
    add_heading(doc, "Promotions", 2)
    add_promotions(doc, "services")
    add_heading(doc, "Published Reviews", 2)
    doc.add_paragraph(
        "The storefront displays only reviews marked for publication. Reviews can be associated with a service and show rating, title, body, reviewer name, and date. Publication control prevents private or unapproved records from appearing automatically."
    )
    add_heading(doc, "Appointment Reminders", 2)
    add_bullets(
        doc,
        [
            "Reminder rules can schedule one or more lead times before an appointment.",
            "Reminder rows and delivery status are stored for operational tracking.",
            "Actual delivery depends on the configured email or messaging provider and scheduled reminder worker.",
            "A scheduled reminder is not a substitute for confirming that the booking and customer email are correct.",
        ],
    )
    add_customers_analytics_team(doc, "appointments")
    add_plans(doc)
    add_common_operations(
        doc,
        [
            "Review today's appointments, pending requests, provider assignments, payment requirements, and customer notes.",
            "Confirm that providers are active and their weekly schedules reflect absences or changed hours.",
            "Verify deposits and full payments against actual bank records before confirmation.",
            "Confirm eligible pending appointments and send the customer confirmation.",
            "Update completed, cancelled, and no-show statuses promptly.",
            "Check upcoming bookings for conflicts, unassigned providers, or missing contact information.",
            "Monitor reminder status and contact customers directly if configured delivery fails.",
        ],
    )
    add_troubleshooting(
        doc,
        [
            ("No time slots appear", "Confirm business hours, service duration, provider assignment and availability, existing appointments, the selected future date, and active subscription access."),
            ("A provider does not appear", "Confirm the provider is active, accepts appointments, and is assigned to the selected service."),
            ("A service shows Unassigned under Departments", "Creating a department does not assign services. Select the department from the service dropdown. Existing category text alone is not a department assignment."),
            ("A service disappeared after department changes", "Check whether its assigned department was deactivated. Reactivate the department or reassign the service."),
            ("Confirm appointment is disabled", "Review the required deposit or full-payment rule and record or verify the amount required before confirmation."),
            ("The customer cannot reschedule", "The booking may be completed, cancelled, no-show, outside the allowed window, or the customer may need to verify Track Booking again."),
        ],
    )
    return save(doc, "YuhBusiness_Appointment_Business_User_Guide.docx")


if __name__ == "__main__":
    paths = [
        build_ordering_guide(),
        build_retail_guide(),
        build_appointment_guide(),
    ]
    for path in paths:
        print(path)

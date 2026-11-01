import io
from decimal import Decimal
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle

from app.models.invoice import Invoice


def generate_invoice_pdf(invoice: Invoice) -> io.BytesIO:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=40,
        leftMargin=40,
        topMargin=40,
        bottomMargin=40,
    )
    styles = getSampleStyleSheet()

    # Custom styles
    title_style = ParagraphStyle(
        "InvoiceTitle",
        parent=styles["Heading1"],
        fontSize=24,
        textColor=colors.HexColor("#0f172a"),
        spaceAfter=4,
    )
    subtitle_style = ParagraphStyle(
        "InvoiceSubtitle",
        parent=styles["Normal"],
        fontSize=10,
        textColor=colors.HexColor("#64748b"),
        spaceAfter=15,
    )
    header_style = ParagraphStyle(
        "HeaderStyle",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#334155"),
    )
    body_style = ParagraphStyle(
        "BodyStyle",
        parent=styles["Normal"],
        fontSize=9,
        textColor=colors.HexColor("#1e293b"),
    )
    bold_style = ParagraphStyle(
        "BoldStyle",
        parent=styles["Normal"],
        fontSize=9,
        fontName="Helvetica-Bold",
        textColor=colors.HexColor("#0f172a"),
    )

    elements = []

    # Header section
    elements.append(Paragraph("<b>BRIGHTLOOP SOFTWARE</b>", title_style))
    elements.append(Paragraph("Subscription Management & Cloud Solutions | invoice@brightloop.io", subtitle_style))
    elements.append(Spacer(1, 10))

    # Meta table: Customer Info vs Invoice Info
    customer_info = f"""
    <b>Billed To:</b><br/>
    {invoice.customer.company_name or invoice.customer.full_name}<br/>
    {invoice.customer.full_name}<br/>
    Email: {invoice.customer.email}<br/>
    Phone: {invoice.customer.phone or 'N/A'}
    """
    invoice_info = f"""
    <b>Invoice #:</b> {invoice.invoice_number}<br/>
    <b>Status:</b> {invoice.status}<br/>
    <b>Issue Date:</b> {invoice.issue_date.strftime('%Y-%m-%d')}<br/>
    <b>Due Date:</b> {invoice.due_date.strftime('%Y-%m-%d')}<br/>
    <b>Payment Terms:</b> {invoice.payment_terms}
    """

    meta_table = Table(
        [
            [
                Paragraph(customer_info, body_style),
                Paragraph(invoice_info, body_style),
            ]
        ],
        colWidths=[270, 260],
    )
    meta_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 12),
    ]))
    elements.append(meta_table)
    elements.append(Spacer(1, 15))

    # Line items table
    table_data = [[
        Paragraph("Description", header_style),
        Paragraph("Qty", header_style),
        Paragraph("Unit Price", header_style),
        Paragraph("Tax", header_style),
        Paragraph("Total", header_style),
    ]]

    for line in invoice.lines:
        desc = line.product_name
        if line.variant_name:
            desc += f" ({line.variant_name})"
        table_data.append([
            Paragraph(desc, body_style),
            Paragraph(str(line.quantity), body_style),
            Paragraph(f"${line.unit_price:.2f}", body_style),
            Paragraph(f"{line.tax_rate}% (${line.tax_amount:.2f})", body_style),
            Paragraph(f"${line.total_amount:.2f}", body_style),
        ])

    items_table = Table(table_data, colWidths=[230, 50, 80, 90, 80])
    items_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#f1f5f9")),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e1")),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    elements.append(items_table)
    elements.append(Spacer(1, 15))

    # Totals table
    totals_data = [
        [Paragraph("", body_style), Paragraph("Subtotal:", bold_style), Paragraph(f"${invoice.subtotal:.2f}", body_style)],
        [Paragraph("", body_style), Paragraph("Discount:", bold_style), Paragraph(f"-${invoice.discount_amount:.2f}", body_style)],
        [Paragraph("", body_style), Paragraph("Tax:", bold_style), Paragraph(f"${invoice.tax_amount:.2f}", body_style)],
        [Paragraph("", body_style), Paragraph("Total:", bold_style), Paragraph(f"<b>${invoice.total_amount:.2f}</b>", bold_style)],
        [Paragraph("", body_style), Paragraph("Amount Paid:", bold_style), Paragraph(f"${invoice.amount_paid:.2f}", body_style)],
        [Paragraph("", body_style), Paragraph("Balance Due:", bold_style), Paragraph(f"<b>${invoice.balance_due:.2f}</b>", bold_style)],
    ]
    totals_table = Table(totals_data, colWidths=[310, 110, 110])
    totals_table.setStyle(TableStyle([
        ('ALIGN', (1, 0), (-1, -1), 'RIGHT'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
    ]))
    elements.append(totals_table)

    if invoice.notes:
        elements.append(Spacer(1, 20))
        elements.append(Paragraph(f"<b>Notes:</b> {invoice.notes}", body_style))

    doc.build(elements)
    buffer.seek(0)
    return buffer

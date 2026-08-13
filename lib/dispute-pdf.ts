// ─── Delivery Summary → PDF ──────────────────────────────────────────────────
//
// Renders a dispute summary as a printable A4 document. jsPDF is imported
// dynamically so it only reaches the browser when someone actually downloads.

import type { jsPDF } from "jspdf";
import { DISPUTE_SECTIONS, type DisputeResult } from "./dispute";
import { formatDateTime } from "./format";

// Page geometry (points).
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_H = 42;

// Palette, matching the app.
const WINE_950: RGB = [86, 28, 36];
const WINE_900: RGB = [109, 41, 50];
const TAUPE_600: RGB = [125, 101, 84];
const TAUPE_200: RGB = [211, 196, 178];
const TAUPE_100: RGB = [226, 215, 202];
const SAND_100: RGB = [244, 236, 223];
const BODY: RGB = [74, 58, 50];

type RGB = [number, number, number];

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "summary"
  );
}

/** Cursor-based layout helper — keeps the page-break logic in one place. */
class Doc {
  y = MARGIN;

  constructor(private readonly doc: jsPDF) {}

  private ensure(height: number) {
    if (this.y + height > PAGE_H - MARGIN - FOOTER_H) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  gap(height: number) {
    this.y += height;
  }

  rule(color: RGB = TAUPE_200, width = 0.5) {
    this.ensure(8);
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    this.doc.line(MARGIN, this.y, PAGE_W - MARGIN, this.y);
    this.y += width;
  }

  /** Small letter-spaced uppercase label. */
  kicker(text: string, color: RGB = TAUPE_600) {
    this.ensure(14);
    this.doc.setFont("helvetica", "bold");
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...color);
    this.doc.setCharSpace(1.2);
    this.doc.text(text.toUpperCase(), MARGIN, this.y);
    this.doc.setCharSpace(0);
    this.y += 12;
  }

  paragraph(
    text: string,
    options: { size?: number; leading?: number; color?: RGB; bold?: boolean; indent?: number } = {}
  ) {
    const size = options.size ?? 9.5;
    const leading = options.leading ?? size * 1.5;
    const indent = options.indent ?? 0;

    this.doc.setFont("helvetica", options.bold ? "bold" : "normal");
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(options.color ?? BODY));

    const lines: string[] = this.doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      this.ensure(leading);
      this.doc.text(line, MARGIN + indent, this.y);
      this.y += leading;
    }
  }

  bullet(text: string) {
    const leading = 14;
    this.doc.setFont("helvetica", "normal");
    this.doc.setFontSize(9.5);
    this.doc.setTextColor(...BODY);

    const lines: string[] = this.doc.splitTextToSize(text, CONTENT_W - 14);
    lines.forEach((line, i) => {
      this.ensure(leading);
      if (i === 0) {
        this.doc.setFillColor(...WINE_900);
        this.doc.circle(MARGIN + 3, this.y - 3, 1.6, "F");
      }
      this.doc.text(line, MARGIN + 14, this.y);
      this.y += leading;
    });
  }

  /** A row of evenly-spaced figures in tinted boxes. */
  metrics(tiles: { label: string; value: string }[]) {
    const boxH = 46;
    const gutter = 10;
    const boxW = (CONTENT_W - gutter * (tiles.length - 1)) / tiles.length;
    this.ensure(boxH + 8);

    tiles.forEach((tile, i) => {
      const x = MARGIN + i * (boxW + gutter);
      this.doc.setFillColor(...SAND_100);
      this.doc.setDrawColor(...TAUPE_200);
      this.doc.setLineWidth(0.5);
      this.doc.roundedRect(x, this.y, boxW, boxH, 6, 6, "FD");

      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6.5);
      this.doc.setTextColor(...TAUPE_600);
      this.doc.setCharSpace(1);
      this.doc.text(tile.label.toUpperCase(), x + 10, this.y + 17);
      this.doc.setCharSpace(0);

      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(12);
      this.doc.setTextColor(...WINE_950);
      this.doc.text(tile.value, x + 10, this.y + 34);
    });

    this.y += boxH;
  }

  table(headers: string[], widths: number[], rows: string[][], rightAlign: number[] = []) {
    const colX = widths.reduce<number[]>((acc, w, i) => {
      acc.push(i === 0 ? MARGIN : acc[i - 1] + widths[i - 1]);
      return acc;
    }, []);

    const drawHead = () => {
      this.ensure(24);
      this.doc.setFont("helvetica", "bold");
      this.doc.setFontSize(6.5);
      this.doc.setTextColor(...TAUPE_600);
      this.doc.setCharSpace(0.8);
      headers.forEach((h, i) => {
        const isRight = rightAlign.includes(i);
        this.doc.text(h.toUpperCase(), isRight ? colX[i] + widths[i] - 4 : colX[i], this.y, {
          align: isRight ? "right" : "left",
        });
      });
      this.doc.setCharSpace(0);
      this.y += 6;
      this.rule(TAUPE_200);
      this.y += 12;
    };

    drawHead();

    rows.forEach((row) => {
      // Wrap each cell, then size the row to its tallest column.
      const cells = row.map((cell, i) =>
        this.doc.splitTextToSize(cell, widths[i] - 8)
      ) as string[][];
      const rowH = Math.max(...cells.map((c) => c.length)) * 11 + 8;

      if (this.y + rowH > PAGE_H - MARGIN - FOOTER_H) {
        this.doc.addPage();
        this.y = MARGIN;
        drawHead();
      }

      this.doc.setFont("helvetica", "normal");
      this.doc.setFontSize(8.5);

      cells.forEach((lines, i) => {
        const isRight = rightAlign.includes(i);
        this.doc.setTextColor(...(i === 0 ? WINE_950 : BODY));
        lines.forEach((line, li) => {
          this.doc.text(line, isRight ? colX[i] + widths[i] - 8 : colX[i], this.y + li * 11, {
            align: isRight ? "right" : "left",
          });
        });
      });

      this.y += rowH;
      this.doc.setDrawColor(...TAUPE_100);
      this.doc.setLineWidth(0.5);
      this.doc.line(MARGIN, this.y - 6, PAGE_W - MARGIN, this.y - 6);
    });
  }
}

export async function downloadDisputePdf(
  result: DisputeResult,
  subject: string,
  clientName: string
): Promise<void> {
  const { jsPDF: JsPDF } = await import("jspdf");
  const doc = new JsPDF({ unit: "pt", format: "a4", compress: true });
  const d = new Doc(doc);

  const generated = formatDateTime(result.evidence.generated_at);
  const totals = result.evidence.totals;

  // ── Masthead ───────────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...WINE_950);
  doc.setCharSpace(2);
  doc.text("TASKORA", MARGIN, d.y);
  doc.setCharSpace(0);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...TAUPE_600);
  doc.text(generated, PAGE_W - MARGIN, d.y, { align: "right" });
  d.gap(14);

  doc.setDrawColor(...WINE_950);
  doc.setLineWidth(1.5);
  doc.line(MARGIN, d.y, PAGE_W - MARGIN, d.y);
  d.gap(26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...WINE_950);
  doc.text("Delivery Summary", MARGIN, d.y);
  d.gap(18);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...TAUPE_600);
  const scopeLine =
    result.evidence.scope === "deliverable"
      ? `${subject} — ${clientName}`
      : `${clientName} · whole project`;
  doc.text(
    `${scopeLine}  ·  ${result.source === "ai" ? "AI-written" : "Generated from records"}`,
    MARGIN,
    d.y
  );
  d.gap(24);

  // ── Headline ───────────────────────────────────────────────────────────────
  d.paragraph(result.report.headline, { size: 11, leading: 16, color: WINE_950 });
  d.gap(18);

  // ── Figures ────────────────────────────────────────────────────────────────
  d.metrics([
    { label: "Delivered", value: totals.delivered_value_formatted },
    { label: "Proof files", value: `${totals.proof_file_count}/${totals.deliverable_count}` },
    { label: "Acknowledged", value: `${totals.acknowledged_count}/${totals.deliverable_count}` },
    { label: "Outstanding", value: totals.unpaid_value_formatted },
  ]);
  d.gap(26);

  // ── Narrative sections ─────────────────────────────────────────────────────
  for (const { key, label } of DISPUTE_SECTIONS) {
    d.kicker(label);
    d.paragraph(result.report[key] as string);
    d.gap(12);
  }

  d.kicker("Context");
  d.paragraph(result.report.neutral_observations);
  d.gap(20);

  // ── Missing evidence ───────────────────────────────────────────────────────
  d.kicker("Missing evidence", WINE_900);
  for (const item of result.report.missing_or_inconsistent) {
    d.bullet(item);
  }
  d.gap(20);

  // ── Records ────────────────────────────────────────────────────────────────
  if (result.evidence.deliverables.length > 0) {
    d.kicker("Records used");
    d.table(
      ["Deliverable", "Amount", "Logged", "Proof", "Ack.", "Payment"],
      [175, 70, 105, 45, 45, 59],
      result.evidence.deliverables.map((row) => [
        row.title,
        row.amount_formatted,
        row.delivered_at_display,
        row.proof_file_attached ? "Yes" : "—",
        row.client_acknowledged ? "Yes" : "—",
        row.paid ? "Paid" : "Unpaid",
      ]),
      [1]
    );
    d.gap(16);
  }

  // ── Activity trail ─────────────────────────────────────────────────────────
  if (result.evidence.activity.length > 0) {
    d.kicker("Activity trail");
    for (const entry of result.evidence.activity) {
      d.paragraph(`${entry.at_display} — ${entry.event}`, { size: 8.5, leading: 12 });
      d.gap(2);
    }
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const footerY = PAGE_H - MARGIN + 6;

    doc.setDrawColor(...TAUPE_200);
    doc.setLineWidth(0.5);
    doc.line(MARGIN, footerY - 14, PAGE_W - MARGIN, footerY - 14);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...TAUPE_600);
    doc.text(result.disclaimer, MARGIN, footerY, { maxWidth: CONTENT_W - 70 });
    doc.text(`${page} / ${pages}`, PAGE_W - MARGIN, footerY, { align: "right" });
  }

  const stamp = new Date(result.evidence.generated_at).toISOString().slice(0, 10);
  doc.save(`taskora-delivery-summary-${slugify(subject)}-${stamp}.pdf`);
}

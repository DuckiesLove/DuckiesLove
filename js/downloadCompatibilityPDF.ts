const CONSENT_IDS = {
  style: 'tk-consent-style',
  overlay: 'tk-consent-overlay',
  card: 'tk-consent-card',
  title: 'tk-consent-title',
  message: 'tk-consent-message',
  actions: 'tk-consent-actions',
  confirm: 'tk-consent-confirm',
  cancel: 'tk-consent-cancel'
} as const;

const CONSENT_COPY = {
  title: 'Consent Check',
  message: "Do you have your partner's consent to export or share this compatibility PDF?"
} as const;

let pendingConsent: Promise<boolean> | null = null;

function shouldBypassConsent(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') return true;
  const doc = document;
  if (!doc || !doc.body || typeof doc.createElement !== 'function') return true;
  if (typeof doc.getElementById !== 'function' || typeof doc.addEventListener !== 'function') return true;
  try {
    const probe = doc.createElement('button');
    if (!probe || typeof (probe as HTMLElement).addEventListener !== 'function') return true;
    if (typeof doc.body.appendChild !== 'function') return true;
  } catch {
    return true;
  }
  return false;
}

function injectConsentStyle(): void {
  if (shouldBypassConsent()) return;
  const doc = document;
  if (doc.getElementById(CONSENT_IDS.style)) return;
  const style = doc.createElement('style');
  style.id = CONSENT_IDS.style;
  style.textContent = `
    #${CONSENT_IDS.overlay}{position:fixed;inset:0;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.55);z-index:99999}
    #${CONSENT_IDS.card}{max-width:520px;width:90%;background:#111;color:#fff;border:1px solid #444;border-radius:10px;padding:18px 16px;box-shadow:0 10px 30px rgba(0,0,0,.6);font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    #${CONSENT_IDS.card} h3{margin:0 0 10px 0;font-size:18px}
    #${CONSENT_IDS.card} p{margin:0 0 12px 0;line-height:1.4}
    #${CONSENT_IDS.actions}{display:flex;gap:10px;justify-content:flex-end;margin-top:12px}
    .tk-btn{padding:8px 14px;border-radius:8px;border:1px solid #555;background:#1f1f1f;color:#fff;cursor:pointer}
    .tk-btn:hover{filter:brightness(1.15)}
    .tk-btn.primary{background:#2a7;border-color:#2a7}
  `;
  doc.head?.appendChild(style);
}

type ConsentElements = {
  overlay: HTMLDivElement;
  titleEl: HTMLElement | null;
  messageEl: HTMLElement | null;
  confirmBtn: HTMLButtonElement | null;
  cancelBtn: HTMLButtonElement | null;
};

function ensureConsentModal(): ConsentElements | null {
  if (shouldBypassConsent()) return null;
  injectConsentStyle();
  const doc = document;
  let overlay = doc.getElementById(CONSENT_IDS.overlay) as HTMLDivElement | null;
  if (overlay) {
    return {
      overlay,
      titleEl: doc.getElementById(CONSENT_IDS.title),
      messageEl: doc.getElementById(CONSENT_IDS.message),
      confirmBtn: doc.getElementById(CONSENT_IDS.confirm) as HTMLButtonElement | null,
      cancelBtn: doc.getElementById(CONSENT_IDS.cancel) as HTMLButtonElement | null,
    };
  }

  overlay = doc.createElement('div');
  overlay.id = CONSENT_IDS.overlay;
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.style.display = 'none';

  const card = doc.createElement('div');
  card.id = CONSENT_IDS.card;

  const titleEl = doc.createElement('h3');
  titleEl.id = CONSENT_IDS.title;
  titleEl.textContent = CONSENT_COPY.title;

  const messageEl = doc.createElement('p');
  messageEl.id = CONSENT_IDS.message;
  messageEl.textContent = CONSENT_COPY.message;

  const actions = doc.createElement('div');
  actions.id = CONSENT_IDS.actions;

  const cancelBtn = doc.createElement('button');
  cancelBtn.id = CONSENT_IDS.cancel;
  cancelBtn.className = 'tk-btn';
  cancelBtn.type = 'button';
  cancelBtn.textContent = 'Cancel';

  const confirmBtn = doc.createElement('button');
  confirmBtn.id = CONSENT_IDS.confirm;
  confirmBtn.className = 'tk-btn primary';
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'I Confirm';

  actions.append(cancelBtn, confirmBtn);
  card.append(titleEl, messageEl, actions);
  overlay.appendChild(card);
  (doc.body || doc.documentElement).appendChild(overlay);

  return { overlay, titleEl, messageEl, confirmBtn, cancelBtn };
}

function requestConsent(): Promise<boolean> {
  if (shouldBypassConsent()) return Promise.resolve(true);
  if (pendingConsent) return pendingConsent;

  const modal = ensureConsentModal();
  if (!modal) return Promise.resolve(true);

  const { overlay, titleEl, messageEl, confirmBtn, cancelBtn } = modal;
  if (!overlay || !confirmBtn || !cancelBtn) return Promise.resolve(true);

  if (titleEl) titleEl.textContent = CONSENT_COPY.title;
  if (messageEl) messageEl.textContent = CONSENT_COPY.message;

  overlay.style.display = 'flex';
  overlay.setAttribute('data-open', 'true');

  pendingConsent = new Promise<boolean>((resolve) => {
    let settled = false;
    const cleanup = (result: boolean) => {
      if (settled) return;
      settled = true;
      overlay.style.display = 'none';
      overlay.removeAttribute('data-open');
      confirmBtn.removeEventListener('click', onConfirm);
      cancelBtn.removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onOverlayClick);
      document.removeEventListener?.('keydown', onKey);
      resolve(result);
    };

    const onConfirm = () => cleanup(true);
    const onCancel = () => cleanup(false);
    const onOverlayClick = (ev: Event) => {
      if (ev.target === overlay) cleanup(false);
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') cleanup(false);
    };

    confirmBtn.addEventListener('click', onConfirm);
    cancelBtn.addEventListener('click', onCancel);
    overlay.addEventListener('click', onOverlayClick);
    document.addEventListener?.('keydown', onKey);
  }).finally(() => {
    pendingConsent = null;
  });

  if (typeof confirmBtn.focus === 'function') {
    confirmBtn.focus();
  }

  return pendingConsent;
}

const loadScript = (src: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.tkLoaded) return resolve();
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Failed to load " + src)),
        { once: true }
      );
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.dataset.tkLoaded = "pending";
    s.onload = () => {
      s.dataset.tkLoaded = "true";
      resolve();
    };
    s.onerror = () => {
      s.dataset.tkLoaded = "error";
      reject(new Error("Failed to load " + src));
    };
    document.head.appendChild(s);
  });

const scriptDir: URL = (() => {
  try {
    const current = document.currentScript as HTMLScriptElement | null;
    if (current?.src) return new URL("./", current.src);
  } catch (_err) {}
  return new URL("./", window.location.href);
})();
const pageDir = new URL("./", window.location.href);
const toHref = (base: URL, relative: string): string => {
  try {
    return new URL(relative, base).href;
  } catch (_err) {
    return relative;
  }
};
const uniq = (sources: string[]): string[] => {
  const seen = new Set<string>();
  return sources.filter((src) => {
    if (!src || seen.has(src)) return false;
    seen.add(src);
    return true;
  });
};

const JSPDF_SOURCES = uniq([
  toHref(scriptDir, "vendor/jspdf.umd.min.js"),
  toHref(scriptDir, "../vendor/jspdf.umd.min.js"),
  toHref(scriptDir, "../assets/js/vendor/jspdf.umd.min.js"),
  toHref(pageDir, "js/vendor/jspdf.umd.min.js"),
  toHref(pageDir, "assets/js/vendor/jspdf.umd.min.js"),
  toHref(pageDir, "../js/vendor/jspdf.umd.min.js"),
  toHref(pageDir, "../assets/js/vendor/jspdf.umd.min.js"),
  "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
]);

const AUTOTABLE_SOURCES = uniq([
  toHref(scriptDir, "vendor/jspdf.plugin.autotable.min.js"),
  toHref(scriptDir, "../vendor/jspdf.plugin.autotable.min.js"),
  toHref(scriptDir, "../assets/js/vendor/jspdf.plugin.autotable.min.js"),
  toHref(pageDir, "js/vendor/jspdf.plugin.autotable.min.js"),
  toHref(pageDir, "assets/js/vendor/jspdf.plugin.autotable.min.js"),
  toHref(pageDir, "../js/vendor/jspdf.plugin.autotable.min.js"),
  toHref(pageDir, "../assets/js/vendor/jspdf.plugin.autotable.min.js"),
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js",
]);

async function ensureFromSources(
  predicate: () => boolean,
  sources: string[],
  label: string
): Promise<void> {
  if (predicate()) return;
  for (const src of sources) {
    if (predicate()) break;
    try {
      await loadScript(src);
      if (predicate()) return;
    } catch (err) {
      console.warn(`[downloadCompatibilityPDF] Failed to load ${label} from`, src, err);
    }
  }
}

async function ensureLibs(): Promise<void> {
  const hasJsPDF = () => Boolean((window as any).jspdf?.jsPDF || (window as any).jsPDF);
  if (!hasJsPDF()) {
    await ensureFromSources(hasJsPDF, JSPDF_SOURCES, "jsPDF");
  }
  if (!hasJsPDF()) {
    throw new Error("jsPDF failed to load.");
  }

  if ((window as any).jspdf?.jsPDF && !(window as any).jsPDF) {
    (window as any).jsPDF = (window as any).jspdf.jsPDF;
  }

  const hasAutoTable = () =>
    Boolean(
      (window as any).jspdf?.autoTable ||
        (window as any).jspdf?.jsPDF?.API?.autoTable ||
        (window as any).jsPDF?.API?.autoTable
    );
  if (!hasAutoTable()) {
    await ensureFromSources(hasAutoTable, AUTOTABLE_SOURCES, "jsPDF-AutoTable");
  }
  if (!hasAutoTable()) {
    throw new Error("jsPDF-AutoTable failed to load.");
  }
}

type ColumnAlign = "left" | "center" | "right";
type ColumnInput =
  | string
  | {
      header?: string;
      title?: string;
      label?: string;
      dataKey?: string;
      key?: string;
      field?: string;
      name?: string;
      align?: ColumnAlign;
      halign?: ColumnAlign;
      cellWidth?: number;
    };

type NormalizedColumn = {
  header: string;
  dataKey?: string | number | symbol;
  align: ColumnAlign;
  cellWidth?: number;
};

type DownloadRowInput = Record<string, unknown> | unknown[];

interface DownloadOptions {
  filename?: string;
  orientation?: string;
  format?: string | [number, number];
  columns?: ColumnInput[];
  rows?: DownloadRowInput[];
}

type ExtractedRow =
  | { type: "header"; category: string }
  | { type: "row"; category: string; A: number | string; pct: string; B: number | string };

const DEFAULT_COLUMNS: ColumnInput[] = [
  { header: "Category", dataKey: "category", align: "left" },
  { header: "Partner A", dataKey: "a", align: "center" },
  { header: "Match %", dataKey: "m", align: "center" },
  { header: "Partner B", dataKey: "b", align: "center" },
];

function normalizeColumns(columns?: ColumnInput[]): NormalizedColumn[] {
  const source = Array.isArray(columns) && columns.length ? columns : DEFAULT_COLUMNS;
  return source.map((col, idx) => {
    if (typeof col === "string") {
      return {
        header: col,
        dataKey: col,
        align: idx === 0 ? "left" : "center",
      } satisfies NormalizedColumn;
    }
    const header = col.header ?? col.title ?? col.label ?? "";
    const dataKey = col.dataKey ?? col.key ?? col.field ?? col.name ?? col.header ?? col.title;
    return {
      header: header || String(dataKey ?? ""),
      dataKey,
      align: col.align || col.halign || (idx === 0 ? "left" : "center"),
      cellWidth: col.cellWidth,
    } satisfies NormalizedColumn;
  });
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") return "—";
  const text = String(value).trim();
  if (!text) return "—";
  if (text === "&&&") return "N/A";
  return text;
}

function normalizeProvidedRows(rows: DownloadRowInput[] | undefined, columns: NormalizedColumn[]): string[][] {
  if (!Array.isArray(rows)) return [];
  return rows.map((raw) => {
    if (Array.isArray(raw)) {
      return raw.map((v) => formatCellValue(v));
    }
    if (!raw || typeof raw !== "object") {
      return columns.map(() => "—");
    }
    return columns.map((col) => {
      const key = col.dataKey;
      const value = key != null && Object.prototype.hasOwnProperty.call(raw, key)
        ? (raw as Record<string, unknown>)[key as keyof typeof raw]
        : (raw as Record<string, unknown>)[col.header as keyof typeof raw];
      return formatCellValue(value);
    });
  });
}

function extractRows(table: HTMLTableElement): ExtractedRow[] {
  const trs = Array.from(table.querySelectorAll("tr")).filter(
    (tr) => tr.querySelectorAll("td").length > 0
  );

  return trs.map((tr) => {
    const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
      (td.textContent || "")
        .replace(/\s+/g, " ")
        .replace(/([A-Za-z]+)\s*\1/, "$1")
        .trim()
    );

    let category = cells[0] || "—";
    if (/^cum$/i.test(category)) category = "Cum Play";

    const toNum = (v: unknown): number | null => {
      const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    const nums = cells.map(toNum).filter((n): n is number => n !== null);

    if (nums.length === 0 && cells.slice(1).every((c) => !c)) {
      return { type: "header", category } satisfies ExtractedRow;
    }

    const A = nums.length ? nums[0] : null;
    const B = nums.length > 1 ? nums[nums.length - 1] : null;

    let pct = cells.find((c) => /%$/.test(c)) || null;
    if (!pct && A != null && B != null) {
      const p = Math.round(100 - (Math.abs(A - B) / 5) * 100);
      pct = `${Math.max(0, Math.min(100, p))}%`;
    }

    return {
      type: "row",
      category,
      A: A ?? "—",
      pct: pct ?? "—",
      B: B ?? "—",
    } satisfies ExtractedRow;
  });
}

export async function downloadCompatibilityPDF(options: DownloadOptions = {}): Promise<void> {
  const {
    filename = "compatibility-report.pdf",
    orientation = "landscape",
    format = "a4",
    columns,
    rows,
  } = options;

  const consentOk = await requestConsent();
  if (!consentOk) return;

  await ensureLibs();

  const columnDefs = normalizeColumns(columns);
  const tableHead = [columnDefs.map((col) => col.header || "")];
  const columnStyles: Record<number, { halign?: ColumnAlign; cellWidth?: number }> = {};
  columnDefs.forEach((col, idx) => {
    columnStyles[idx] = { halign: col.align };
    if (typeof col.cellWidth === "number") columnStyles[idx].cellWidth = col.cellWidth;
  });

  const hasProvidedRows = Array.isArray(rows) && rows.length > 0;

  let body: any[] = [];

  if (hasProvidedRows) {
    body = normalizeProvidedRows(rows, columnDefs);
    if (!body.length) {
      console.warn("[pdf] No data rows provided to export.");
      return;
    }
  } else {
    const table =
      document.querySelector<HTMLTableElement>("#compatibilityTable") ||
      document.querySelector<HTMLTableElement>(".results-table.compat") ||
      document.querySelector<HTMLTableElement>("table");

    if (!table) {
      alert("No table found on the page.");
      return;
    }

    const extracted = extractRows(table);
    if (!extracted.length) {
      alert("No rows to export.");
      return;
    }

    body = extracted.map((row) => {
      if (row.type === "header") {
        return [
          {
            content: row.category,
            colSpan: columnDefs.length,
            styles: {
              fontStyle: "bold",
              halign: "left",
              fillColor: [0, 0, 0],
              textColor: [255, 255, 255],
            },
          },
        ];
      }
      return [
        formatCellValue(row.category),
        formatCellValue(row.A),
        formatCellValue(row.pct),
        formatCellValue(row.B),
      ];
    });
  }

  const JsPDF: any = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
  if (!JsPDF) {
    console.error("jsPDF failed to load");
    return;
  }

  const doc = new JsPDF({ orientation, unit: "pt", format });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const bleed = 3;

  const paintBg = (): void => {
    if (typeof doc.setFillColor === "function") doc.setFillColor(0, 0, 0);
    if (typeof doc.rect === "function") doc.rect(-bleed, -bleed, pageW + bleed * 2, pageH + bleed * 2, "F");
    if (typeof doc.setTextColor === "function") doc.setTextColor(255, 255, 255);
    if (typeof doc.setDrawColor === "function") doc.setDrawColor(0, 0, 0);
    if (typeof doc.setLineWidth === "function") doc.setLineWidth(0);
  };

  paintBg();

  if (typeof doc.setFont === "function") {
    try {
      doc.setFont("helvetica", "normal");
    } catch {
      /* ignore font errors */
    }
  }

  const runAT = (opts: Record<string, unknown>): void => {
    if (typeof doc.autoTable === "function") {
      doc.autoTable(opts);
      return;
    }
    if ((window as any).jspdf && typeof (window as any).jspdf.autoTable === "function") {
      (window as any).jspdf.autoTable(doc, opts);
      return;
    }
    throw new Error("AutoTable not available");
  };

  const originalAddPage = doc.addPage;
  doc.addPage = function patchedAddPage(this: typeof doc, ...args: any[]) {
    const result = originalAddPage.apply(this, args as any);
    paintBg();
    return result;
  } as typeof doc.addPage;

  try {
    let primed = false;
    runAT({
      head: tableHead,
      body,
      startY: -bleed,
      startX: -bleed,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      tableWidth: pageW + bleed * 2,
      horizontalPageBreak: true,
      theme: "plain",
      styles: {
        fontSize: 11,
        cellPadding: 8,
        textColor: [255, 255, 255],
        fillColor: null,
        lineColor: [0, 0, 0],
        lineWidth: 0,
        halign: "center",
        valign: "middle",
        overflow: "linebreak",
        minCellHeight: 18,
      },
      headStyles: {
        fontStyle: "bold",
        fillColor: null,
        textColor: [255, 255, 255],
        lineColor: [0, 0, 0],
        lineWidth: 0,
        cellPadding: 10,
      },
      columnStyles,
      tableLineColor: [0, 0, 0],
      tableLineWidth: 0,
      didAddPage: paintBg,
      willDrawCell: () => {
        if (!primed) {
          primed = true;
          if (typeof doc.setDrawColor === "function") doc.setDrawColor(0, 0, 0);
          if (typeof doc.setLineWidth === "function") doc.setLineWidth(0);
        }
      },
    });
  } finally {
    doc.addPage = originalAddPage;
  }

  doc.save(filename);
}


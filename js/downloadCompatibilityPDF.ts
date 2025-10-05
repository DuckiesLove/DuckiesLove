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

export async function downloadCompatibilityPDF(): Promise<void> {
  const loadScript = (src: string): Promise<void> =>
    new Promise((resolve, reject) => {
      if (document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)) return resolve();
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("Failed to load " + src));
      document.head.appendChild(s);
    });

  async function ensureLibs(): Promise<void> {
    const hasJsPDF = () => Boolean((window as any).jspdf?.jsPDF || (window as any).jsPDF);
    if (!hasJsPDF()) {
      await loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    }

    const hasAutoTable = () =>
      Boolean(
        (window as any).jspdf?.autoTable ||
          (window as any).jspdf?.jsPDF?.API?.autoTable ||
          (window as any).jsPDF?.API?.autoTable
      );
    if (!hasAutoTable()) {
      await loadScript(
        "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js"
      );
    }
  }

  type Row = [string, number | "—", string | "—", number | "—"];

  function extractRows(table: HTMLTableElement): Row[] {
    const trs = Array.from(table.querySelectorAll("tr")).filter(
      (tr) => tr.querySelectorAll("th").length === 0 && tr.querySelectorAll("td").length > 0
    );

    return trs.map((tr) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) =>
        (td.textContent || "")
          .replace(/\s+/g, " ")
          .replace(/([A-Za-z])\1+/g, "$1")
          .trim()
      );

      let category = cells[0] || "—";
      if (/^cum$/i.test(category)) category = "Cum Play";
      category = category.replace(/([A-Za-z]+)\s*\1/, "$1");

      const toNum = (v: unknown): number | null => {
        const n = Number(String(v ?? "").replace(/[^\d.-]/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const nums = cells.map(toNum).filter((n): n is number => n !== null);
      const A = nums.length ? nums[0] : null;
      const B = nums.length > 1 ? nums[nums.length - 1] : null;

      let pct = cells.find((c) => /%$/.test(c)) || null;
      if (!pct && A != null && B != null) {
        const p = Math.round(100 - (Math.abs(A - B) / 5) * 100);
        pct = `${Math.max(0, Math.min(100, p))}%`;
      }

      return [category, A ?? "—", pct ?? "—", B ?? "—"] as Row;
    });
  }

  try {
    const consentOk = await requestConsent();
    if (!consentOk) return;

    await ensureLibs();
    const JsPDF: any = (window as any).jspdf?.jsPDF || (window as any).jsPDF;
    const table =
      document.querySelector<HTMLTableElement>("#compatibilityTable") ||
      document.querySelector<HTMLTableElement>(".results-table.compat") ||
      document.querySelector<HTMLTableElement>("table");
    if (!table) {
      alert("No table found on the page.");
      return;
    }
    const body = extractRows(table);
    if (!body.length) {
      alert("No rows to export.");
      return;
    }

    const doc = new JsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();

    const paintBg = (): void => {
      doc.setFillColor(0, 0, 0);
      doc.rect(0, 0, pageW, pageH, "F");
      doc.setTextColor(255, 255, 255);
    };

    paintBg();
    doc.setFontSize(24);
    doc.text("Talk Kink • Compatibility Report", pageW / 2, 42, { align: "center" });

    const marginLR = 30;
    const usable = pageW - marginLR * 2;
    const Awidth = 90,
      Mwidth = 110,
      Bwidth = 90;
    const CatWidth = Math.max(220, usable - (Awidth + Mwidth + Bwidth));

    const runAT = (opts: Record<string, unknown>): void => {
      if (typeof doc.autoTable === "function") return doc.autoTable(opts);
      if ((window as any).jspdf && typeof (window as any).jspdf.autoTable === "function")
        return (window as any).jspdf.autoTable(doc, opts);
      throw new Error("AutoTable not available");
    };

    const originalAddPage = doc.addPage;
    doc.addPage = function patchedAddPage(this: typeof doc, ...args: any[]) {
      const result = originalAddPage.apply(this, args as any);
      paintBg();
      return result;
    } as typeof doc.addPage;

    try {
      runAT({
        head: [["Category", "Partner A", "Match %", "Partner B"]],
        body,
        startY: 64,
        margin: { left: marginLR, right: marginLR, top: 64, bottom: 40 },
        styles: {
          fontSize: 11,
          cellPadding: 6,
          textColor: [255, 255, 255],
          fillColor: [0, 0, 0],
          lineColor: [255, 255, 255],
          lineWidth: 1.2,
          halign: "center",
          valign: "middle",
        },
        headStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          lineColor: [255, 255, 255],
          lineWidth: 1.6,
        },
        bodyStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
        },
        alternateRowStyles: {
          fillColor: [0, 0, 0],
          textColor: [255, 255, 255],
        },
        columnStyles: {
          0: { cellWidth: CatWidth, halign: "left" },
          1: { cellWidth: Awidth, halign: "center" },
          2: { cellWidth: Mwidth, halign: "center" },
          3: { cellWidth: Bwidth, halign: "center" },
        },
        tableWidth: usable,
        willDrawPage: paintBg,
      });
    } finally {
      doc.addPage = originalAddPage;
    }

    doc.save("compatibility-dark.pdf");
  } catch (err) {
    console.error("[TK-PDF] Export failed:", err);
    const msg = err instanceof Error ? err.message : String(err);
    alert("PDF export failed: " + msg);
  }
}


// TalkKink Compatibility PDF (DOM-based)
const TKCompatPDF = {
  rows: [],
  notifyRowsUpdated: function (rowElements) {
    this.rows = rowElements.map(tr => {
      const cells = tr.querySelectorAll("td");
      return {
        kink: cells[0]?.textContent.trim(),
        partnerA: cells[1]?.textContent.trim(),
        match: cells[2]?.textContent.trim(),
        flag: cells[3]?.textContent.trim(),
        partnerB: cells[4]?.textContent.trim(),
      };
    });
  },
  download: function () {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const tableData = this.rows.map(row => [
      row.kink,
      row.partnerA,
      row.match,
      row.flag,
      row.partnerB,
    ]);

    const headers = [["Kink", "A", "%", "Flag", "B"]];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("TalkKink Compatibility Survey", 105, 15, { align: "center" });

    doc.autoTable({
      head: headers,
      body: tableData,
      startY: 25,
      theme: "grid",
      styles: {
        fontSize: 10,
        cellPadding: 2,
        halign: "center",
        valign: "middle",
      },
      headStyles: {
        fillColor: [33, 33, 33],
        textColor: 255,
        fontStyle: "bold",
      },
      columnStyles: {
        0: { halign: "left", cellWidth: 60 }, // kink label
        1: { cellWidth: 20 }, // partner A
        2: { cellWidth: 20 }, // match %
        3: { cellWidth: 20 }, // flag
        4: { cellWidth: 20 }, // partner B
      },
    });

    const timestamp = new Date().toISOString().split("T")[0];
    doc.save(`talkkink-compat-${timestamp}.pdf`);
  },
};

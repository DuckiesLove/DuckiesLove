// 📁 compatPdfGrouped.js

import jsPDF from 'jspdf'
import 'jspdf-autotable'
import { compatLabels, getTealColor, shortenLabel } from './compat_labels_bars_safe.js'

// 🟦 Styles
const headerStyles = {
  halign: 'center',
  fillColor: [15, 15, 15],
  textColor: [255, 255, 255],
  fontSize: 14,
  fontStyle: 'bold'
}

const categoryBoxStyle = {
  fillColor: getTealColor(), // e.g., [0, 150, 136]
  textColor: [255, 255, 255],
  fontStyle: 'bold',
  fontSize: 12
}

const cellFont = {
  fontSize: 10,
  textColor: [230, 230, 230]
}

// 📊 Generate a compatibility bar
function renderMatchBar(matchPercent) {
  const barLength = 30
  const filled = Math.round((matchPercent / 100) * barLength)
  return '█'.repeat(filled) + '░'.repeat(barLength - filled)
}

// 🧾 Main PDF export
export function generateGroupedCompatibilityPDF(data) {
  const doc = new jsPDF()
  doc.setTextColor(255)
  doc.setFont('helvetica', 'normal')

  doc.setFontSize(18)
  doc.text('🖤 Kink Compatibility Report', 105, 15, { align: 'center' })

  const grouped = groupByCategory(data)

  let y = 30
  Object.entries(grouped).forEach(([category, items]) => {
    doc.setFillColor(...categoryBoxStyle.fillColor)
    doc.setTextColor(...categoryBoxStyle.textColor)
    doc.setFontSize(categoryBoxStyle.fontSize)
    doc.setFont(undefined, categoryBoxStyle.fontStyle)
    doc.rect(15, y - 6, 180, 8, 'F')
    doc.text(category, 105, y, { align: 'center' })
    y += 4

    const rows = items.map(item => [
      shortenLabel(item.label),
      item.partnerA ?? '-',
      renderMatchBar(item.match),
      item.partnerB ?? '-',
      item.match + '%'
    ])

    doc.autoTable({
      startY: y + 2,
      head: [['Kink', 'A', 'Match', 'B', '%']],
      body: rows,
      theme: 'grid',
      styles: {
        halign: 'center',
        fontSize: cellFont.fontSize,
        textColor: cellFont.textColor
      },
      headStyles: headerStyles,
      margin: { left: 15, right: 15 },
      tableLineColor: [60, 60, 60],
      tableLineWidth: 0.1
    })

    y = doc.lastAutoTable.finalY + 10
  })

  doc.save('kink-compatibility.pdf')
}

// 🧠 Utility: group by kink category
function groupByCategory(data) {
  const out = {}
  data.forEach(item => {
    const group = compatLabels[item.label]?.group || 'Other'
    if (!out[group]) out[group] = []
    out[group].push(item)
  })
  return out
}

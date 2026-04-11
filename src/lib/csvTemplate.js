const SHEETJS_CDN = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs';

/**
 * Creates and downloads a styled .xlsx template that matches the employee template:
 *  - Row 1: Blue header (bold white text, #1D4ED8 fill, thin gray borders, centered)
 *  - Row 2: Yellow example row (italic olive text, #FEF9C3 fill, thin gray borders)
 *  - Rows 3-22: 20 empty pre-formatted data rows with thin gray borders
 *  - Top 2 rows frozen
 *
 * @param {string[]}  headers   - Column header names (row 1)
 * @param {string[]}  example   - Example/hint values (row 2, same length as headers)
 * @param {number[]}  colWidths - Column widths in characters (same length as headers)
 * @param {string}    sheetName - Excel sheet tab name
 * @param {string}    fileName  - Downloaded file name (should end in .xlsx)
 */
export async function generateStyledTemplate({ headers, example, colWidths, sheetName, fileName }) {
  const XLSX = await import(/* @vite-ignore */ SHEETJS_CDN);
  const NUM_DATA_ROWS = 20;

  // Build the data grid: header row + example row + empty data rows
  const data = [
    headers,
    example,
    ...Array(NUM_DATA_ROWS).fill(null).map(() => headers.map(() => '')),
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  // Shared border style (thin gray, matches employee template)
  const b = { style: 'thin', color: { rgb: 'D1D5DB' } };
  const border = { top: b, bottom: b, left: b, right: b };

  const headerStyle = {
    font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
    fill: { patternType: 'solid', fgColor: { rgb: '1D4ED8' } },
    border,
    alignment: { horizontal: 'center', vertical: 'center' },
  };

  const exampleStyle = {
    font: { italic: true, color: { rgb: '92400E' }, sz: 10 },
    fill: { patternType: 'solid', fgColor: { rgb: 'FEF9C3' } },
    border,
    alignment: { horizontal: 'left', vertical: 'center' },
  };

  const dataStyle = {
    border,
    alignment: { vertical: 'center' },
  };

  // Apply styles cell by cell
  for (let c = 0; c < headers.length; c++) {
    const col = XLSX.utils.encode_col(c);

    const hCell = ws[col + '1'];
    if (hCell) hCell.s = headerStyle;

    const eCell = ws[col + '2'];
    if (eCell) eCell.s = exampleStyle;

    for (let r = 3; r <= NUM_DATA_ROWS + 2; r++) {
      const addr = col + r;
      if (!ws[addr]) ws[addr] = { t: 's', v: '' };
      ws[addr].s = dataStyle;
    }
  }

  // Column widths
  ws['!cols'] = colWidths.map((w) => ({ wch: w }));

  // Row heights: header taller, rest standard
  ws['!rows'] = [
    { hpt: 22 },
    { hpt: 18 },
    ...Array(NUM_DATA_ROWS).fill({ hpt: 18 }),
  ];

  // Freeze the top 2 rows (header + example)
  ws['!freeze'] = { xSplit: 0, ySplit: 2 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName || 'Template');

  const buf = XLSX.write(wb, { type: 'array', bookType: 'xlsx', cellStyles: true });
  const blob = new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

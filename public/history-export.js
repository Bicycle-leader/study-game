(() => {
  'use strict';

  const workbookMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const spreadsheetNs = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const officeRelNs = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const packageRelNs = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const xmlDeclaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  const encoder = new TextEncoder();

  const crc32Table = Uint32Array.from({ length: 256 }, (_, byte) => {
    let crc = byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    return crc;
  });

  function crc32(data) {
    let crc = 0xffffffff;
    for (const byte of data) crc = (crc >>> 8) ^ crc32Table[(crc ^ byte) & 0xff];
    return (crc ^ 0xffffffff) >>> 0;
  }

  function escapeText(value) {
    return String(value ?? '')
      .replace(/[^\u0009\u000a\u000d\u0020-\ud7ff\ue000-\ufffd\u{10000}-\u{10ffff}]/gu, '')
      .replace(/_([xX][0-9a-fA-F]{4})_/g, '_x005F_$1_')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\r/g, '&#13;');
  }

  function count(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : 0;
  }

  function collectRows(history) {
    const totals = [['문항', '제출 수', '정답 수', '오답 수', '정답률']];
    const choices = [['문항', '보기', '선택 수']];
    const seenQuestions = new Set();
    for (const entry of history) {
      if (seenQuestions.has(entry.questionId)) continue;
      seenQuestions.add(entry.questionId);
      const total = count(entry.total);
      const correct = count(entry.correctCount);
      totals.push([entry.title, total, correct, count(entry.incorrectCount), total ? correct / total : 0]);
      if (entry.type === 'multiple') {
        for (const { label, count: selections } of entry.optionCounts || []) {
          choices.push([entry.title, label, count(selections)]);
        }
      }
    }
    return { totals, choices };
  }

  function estimatedLines(value, width) {
    if (typeof value !== 'string') return 1;
    return value.split(/\r\n|[\r\n]/).reduce((total, line) => {
      const widthInCharacters = line.replace(/[^\u0000-\u007f]/gu, 'xx').length;
      return total + Math.max(1, Math.ceil(widthInCharacters / (width - 6)));
    }, 0);
  }

  function worksheet(rows, widths, percentageColumn = -1) {
    const lastCell = `${String.fromCharCode(64 + widths.length)}${rows.length}`;
    const columns = widths.map((width, index) => {
      const column = index + 1;
      return `<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`;
    }).join('');
    const data = rows.map((row, index) => {
      const rowNumber = index + 1;
      const lines = Math.max(...row.map((value, column) => estimatedLines(value, widths[column])));
      const height = lines > 1 ? ` ht="${Math.min(409, lines * 16 + 2)}" customHeight="1"` : '';
      const cells = row.map((value, column) => {
        const address = `${String.fromCharCode(65 + column)}${rowNumber}`;
        if (typeof value === 'number') {
          const style = column === percentageColumn ? ' s="1"' : '';
          return `<c r="${address}"${style}><v>${value}</v></c>`;
        }
        const style = index === 0 ? 2 : 3;
        return `<c r="${address}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeText(value)}</t></is></c>`;
      }).join('');
      return `<row r="${rowNumber}"${height}>${cells}</row>`;
    }).join('');
    const filter = rows.length > 1 ? `<autoFilter ref="A1:${lastCell}"/>` : '';
    return `<worksheet xmlns="${spreadsheetNs}">
      <dimension ref="A1:${lastCell}"/>
      <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
      <cols>${columns}</cols><sheetData>${data}</sheetData>${filter}
    </worksheet>`;
  }

  const contentTypes = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
    <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
    <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  </Types>`;

  const rootRelations = `<Relationships xmlns="${packageRelNs}">
    <Relationship Id="rId1" Type="${officeRelNs}/officeDocument" Target="xl/workbook.xml"/>
  </Relationships>`;

  const workbookRelations = `<Relationships xmlns="${packageRelNs}">
    <Relationship Id="rId1" Type="${officeRelNs}/worksheet" Target="worksheets/sheet1.xml"/>
    <Relationship Id="rId2" Type="${officeRelNs}/worksheet" Target="worksheets/sheet2.xml"/>
    <Relationship Id="rId3" Type="${officeRelNs}/styles" Target="styles.xml"/>
  </Relationships>`;

  const workbook = `<workbook xmlns="${spreadsheetNs}" xmlns:r="${officeRelNs}">
    <bookViews><workbookView/></bookViews>
    <sheets>
      <sheet name="문항별 집계" sheetId="1" r:id="rId1"/>
      <sheet name="보기별 선택 수" sheetId="2" r:id="rId2"/>
    </sheets>
  </workbook>`;

  const styles = `<styleSheet xmlns="${spreadsheetNs}">
    <fonts count="2">
      <font><sz val="11"/><name val="Calibri"/></font>
      <font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    </fonts>
    <fills count="3">
      <fill><patternFill patternType="none"/></fill>
      <fill><patternFill patternType="gray125"/></fill>
      <fill><patternFill patternType="solid"><fgColor rgb="FF153E33"/><bgColor indexed="64"/></patternFill></fill>
    </fills>
    <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
    <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
    <cellXfs count="4">
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
      <xf numFmtId="10" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>
      <xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
      <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
    </cellXfs>
    <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
  </styleSheet>`;

  function writeEntryFields(view, start, nameLength, size, checksum) {
    view.setUint16(start, 20, true); // ZIP version 2.0, stored without compression.
    view.setUint16(start + 8, 33, true); // DOS date 1980-01-01.
    view.setUint32(start + 10, checksum, true);
    view.setUint32(start + 14, size, true);
    view.setUint32(start + 18, size, true);
    view.setUint16(start + 22, nameLength, true);
  }

  function zipWorkbook(files) {
    const fileParts = [];
    const catalog = [];
    let offset = 0;
    let catalogSize = 0;
    for (const [name, xml] of files) {
      const path = encoder.encode(name);
      const bytes = encoder.encode(xmlDeclaration + xml);
      const checksum = crc32(bytes);

      const header = new Uint8Array(30 + path.length);
      const headerView = new DataView(header.buffer);
      headerView.setUint32(0, 0x04034b50, true);
      writeEntryFields(headerView, 4, path.length, bytes.length, checksum);
      header.set(path, 30);
      fileParts.push(header, bytes);

      const entry = new Uint8Array(46 + path.length);
      const entryView = new DataView(entry.buffer);
      entryView.setUint32(0, 0x02014b50, true);
      entryView.setUint16(4, 20, true);
      writeEntryFields(entryView, 6, path.length, bytes.length, checksum);
      entryView.setUint32(42, offset, true);
      entry.set(path, 46);
      catalog.push(entry);
      offset += header.length + bytes.length;
      catalogSize += entry.length;
    }

    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true);
    end.setUint16(8, files.length, true);
    end.setUint16(10, files.length, true);
    end.setUint32(12, catalogSize, true);
    end.setUint32(16, offset, true);
    return new Blob([...fileParts, ...catalog, end.buffer], { type: workbookMime });
  }

  window.createHistoryWorkbook = (history) => {
    const { totals, choices } = collectRows(history);
    return zipWorkbook([
      ['[Content_Types].xml', contentTypes],
      ['_rels/.rels', rootRelations],
      ['xl/workbook.xml', workbook],
      ['xl/_rels/workbook.xml.rels', workbookRelations],
      ['xl/styles.xml', styles],
      ['xl/worksheets/sheet1.xml', worksheet(totals, [64, 13, 13, 13, 13], 4)],
      ['xl/worksheets/sheet2.xml', worksheet(choices, [64, 42, 13])],
    ]);
  };
})();

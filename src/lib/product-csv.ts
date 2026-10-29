/**
 * Small, dependency-free CSV helpers for the product catalogue.
 * Supports UTF-8 BOMs, CRLF/LF rows, quoted commas, escaped quotes and
 * embedded line breaks. Malformed quoting fails loudly instead of silently
 * shifting product columns during import.
 */
export function parseCsvRows(source: string): string[][] {
  const input = source.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let wasQuoted = false
  let afterQuote = false
  let line = 1

  const pushField = () => {
    row.push(wasQuoted ? field : field.trim())
    field = ''
    wasQuoted = false
    afterQuote = false
  }

  const pushRow = () => {
    pushField()
    if (row.some((cell) => cell.trim().length > 0)) rows.push(row)
    row = []
  }

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i]

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else {
        field += char
        if (char === '\n') line += 1
      }
      continue
    }

    if (afterQuote) {
      if (char === ',') {
        pushField()
      } else if (char === '\n' || char === '\r') {
        if (char === '\r' && input[i + 1] === '\n') i += 1
        pushRow()
        line += 1
      } else if (char !== ' ' && char !== '\t') {
        throw new Error(`Unexpected character after a quoted CSV field on line ${line}.`)
      }
      continue
    }

    if (char === '"') {
      if (field.trim().length > 0) {
        throw new Error(`Unexpected quote in an unquoted CSV field on line ${line}.`)
      }
      field = ''
      wasQuoted = true
      inQuotes = true
    } else if (char === ',') {
      pushField()
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[i + 1] === '\n') i += 1
      pushRow()
      line += 1
    } else {
      field += char
    }
  }

  if (inQuotes) throw new Error(`Unclosed quoted field in CSV near line ${line}.`)
  if (field.length > 0 || row.length > 0 || wasQuoted || afterQuote) pushRow()
  return rows
}

export function csvCell(value: string): string {
  return '"' + value.replace(/"/g, '""') + '"'
}

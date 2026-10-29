import { describe, expect, test } from 'bun:test'
import { csvCell, parseCsvRows } from '../src/lib/product-csv'

describe('product CSV helpers', () => {
  test('reads a UTF-8 BOM and Windows CRLF rows', () => {
    const rows = parseCsvRows('\uFEFFname,price\r\nSolar panel,45000\r\nTV,120000\r\n')
    expect(rows).toEqual([
      ['name', 'price'],
      ['Solar panel', '45000'],
      ['TV', '120000'],
    ])
  })

  test('keeps commas and line breaks inside quoted cells', () => {
    const rows = parseCsvRows('name,description\r\nPanel,"Reliable, efficient\r\nsolar power"\r\n')
    expect(rows).toEqual([
      ['name', 'description'],
      ['Panel', 'Reliable, efficient\r\nsolar power'],
    ])
  })

  test('unescapes doubled quotes and round-trips exported cells', () => {
    const original = ['Model "A"', 'Solar, home backup', 'line one\nline two']
    const csv = original.map(csvCell).join(',')
    expect(parseCsvRows(csv)).toEqual([original])
  })

  test('ignores empty rows without dropping empty trailing columns', () => {
    expect(parseCsvRows('name,price,notes\nPanel,45000,\n\nTV,120000,For home\n'))
      .toEqual([
        ['name', 'price', 'notes'],
        ['Panel', '45000', ''],
        ['TV', '120000', 'For home'],
      ])
  })

  test('rejects malformed CSV quoting with a useful error', () => {
    expect(() => parseCsvRows('name,description\nPanel,"missing close')).toThrow('Unclosed quoted field')
    expect(() => parseCsvRows('name,description\nPanel,broken"quote')).toThrow('Unexpected quote')
  })
})

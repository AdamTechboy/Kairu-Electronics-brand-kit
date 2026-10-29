'use client'

import { useMemo, useState } from 'react'
import { useApp } from '../app-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, Trash2, FileText, ReceiptText, Download, Pencil, Loader2, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { buildBusinessDocument, BUSINESS_DOCUMENT_LABELS, calculateBusinessDocumentTotals, type BusinessDocumentInput, type BusinessDocumentKind, type BusinessDocumentItem } from '@/lib/design/business-documents'
import { getOfficialLogoDataUrl } from '@/lib/design/logo-resolver'
import { makeThumbnail, downloadPdf, defaultFileName } from '@/lib/export/exporter'
import { projectApi } from '@/lib/api-client'

const today = new Date().toISOString().slice(0, 10)

function freshDocument(kind: BusinessDocumentKind): BusinessDocumentInput {
  const prefix: Record<BusinessDocumentKind, string> = { letter: 'LTR', invoice: 'INV', receipt: 'RCT', quotation: 'QUO', 'delivery-note': 'DN' }
  return {
    kind, documentNumber: `${prefix[kind]}-${today.replace(/-/g, '')}-001`, issueDate: today, dueDate: '',
    customerName: '', customerPhone: '', customerEmail: '', customerAddress: '', destinationCityState: '',
    subject: '', body: '', items: [{ description: '', quantity: '1', unitPrice: '' }],
    discount: '', tax: '', deliveryFee: '', amountPaid: '', paymentMethod: '', deliveryMethod: '',
    shippingReference: '', notes: '', signerName: '', footerNote: '',
  }
}

export function DocumentsView() {
  const { brand, openEditor } = useApp()
  const [form, setForm] = useState<BusinessDocumentInput>(() => freshDocument('receipt'))
  const [saving, setSaving] = useState(false)
  const [action, setAction] = useState<'edit' | 'pdf' | null>(null)

  const set = <K extends keyof BusinessDocumentInput>(key: K, value: BusinessDocumentInput[K]) => setForm((current) => ({ ...current, [key]: value }))
  const setItem = (index: number, patch: Partial<BusinessDocumentItem>) => set('items', form.items.map((item, i) => i === index ? { ...item, ...patch } : item))
  const totals = useMemo(() => calculateBusinessDocumentTotals(form), [form])
  const isLetter = form.kind === 'letter'
  const isDelivery = form.kind === 'delivery-note'
  const money = (value: number) => value.toLocaleString('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 })

  const build = async () => {
    const logo = await getOfficialLogoDataUrl(brand)
    return buildBusinessDocument(form, brand, logo)
  }

  const createAndEdit = async () => {
    if (isLetter && !form.body.trim()) { toast.error('Write the letter content before opening the editor.'); return }
    setSaving(true); setAction('edit')
    try {
      const doc = await build()
      openEditor({ initialDoc: doc, initialName: `${BUSINESS_DOCUMENT_LABELS[form.kind]} - ${form.documentNumber}`.slice(0, 120), initialType: 'document', backTo: 'documents' })
      toast.success('Document opened in the editor. Adjust the layout and save your final changes there.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not build document')
    } finally { setSaving(false); setAction(null) }
  }

  const saveAndDownloadPdf = async () => {
    if (isLetter && !form.body.trim()) { toast.error('Write the letter content before downloading.'); return }
    if (!isLetter && !isDelivery && !form.items.some((item) => item.description.trim())) { toast.error('Add at least one item or product before downloading.'); return }
    setSaving(true); setAction('pdf')
    try {
      const doc = await build()
      const customer = form.customerName.trim() ? ` - ${form.customerName.trim()}` : ''
      const name = `${BUSINESS_DOCUMENT_LABELS[form.kind]} ${form.documentNumber}${customer}`.slice(0, 120)
      const preview = await makeThumbnail(doc, brand.palette, 420)
      const { project } = await projectApi.create({ name, type: 'document', doc, preview })
      const fileName = defaultFileName(brand, { name, type: 'document' }, 'pdf')
      const result = await downloadPdf(doc, brand.palette, {
        mode: 'vector', dpi: 300, transparent: false, fileName,
        paperSize: 'a4-portrait', cropMarks: false, projectId: project.id,
        projectName: name, projectType: 'document', brand,
      })
      toast.success(result.usedFallback ? 'PDF downloaded and the editable document was saved. Some effects used high-resolution image rendering.' : 'PDF downloaded and the editable document was saved in My Designs.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create the PDF')
    } finally { setSaving(false); setAction(null) }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 lg:p-8" data-testid="documents">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><ReceiptText className="h-6 w-6 text-amber-600" /> Documents &amp; Receipts</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">Write letters, invoices, receipts, quotations and delivery notes. Add customer and delivery details for orders going to other cities or states, then edit or download a print-ready PDF.</p>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => setForm(freshDocument(form.kind))}><FileText className="h-4 w-4" /> New document</Button>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(290px,.85fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Document type and reference</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>What are you preparing?</Label>
                <Select value={form.kind} onValueChange={(v) => setForm((old) => ({ ...freshDocument(v as BusinessDocumentKind), customerName: old.customerName, customerPhone: old.customerPhone, customerEmail: old.customerEmail, customerAddress: old.customerAddress, destinationCityState: old.destinationCityState, items: old.items, paymentMethod: old.paymentMethod, deliveryMethod: old.deliveryMethod, shippingReference: old.shippingReference, amountPaid: old.amountPaid, notes: old.notes, signerName: old.signerName, footerNote: old.footerNote }))}>
                  {Object.entries(BUSINESS_DOCUMENT_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                </Select>
              </div>
              <div className="space-y-1.5"><Label>Document number</Label><Input value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} placeholder="RCT-20261029-001" /></div>
              <div className="space-y-1.5"><Label>Issue date</Label><Input type="date" value={form.issueDate} onChange={(e) => set('issueDate', e.target.value)} /></div>
              {['invoice', 'quotation'].includes(form.kind) && <div className="space-y-1.5 sm:col-span-2"><Label>Due date / valid until (optional)</Label><Input type="date" value={form.dueDate} onChange={(e) => set('dueDate', e.target.value)} /></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Customer / recipient</CardTitle></CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Customer or recipient name</Label><Input value={form.customerName} onChange={(e) => set('customerName', e.target.value)} placeholder="Full name or company" /></div>
              <div className="space-y-1.5"><Label>Phone number</Label><Input value={form.customerPhone} onChange={(e) => set('customerPhone', e.target.value)} placeholder="Customer contact" /></div>
              <div className="space-y-1.5"><Label>Email (optional)</Label><Input type="email" value={form.customerEmail} onChange={(e) => set('customerEmail', e.target.value)} placeholder="name@example.com" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Delivery address / street</Label><Input value={form.customerAddress} onChange={(e) => set('customerAddress', e.target.value)} placeholder="House number, street, area" /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>City and state</Label><Input value={form.destinationCityState} onChange={(e) => set('destinationCityState', e.target.value)} placeholder="e.g. Gombe, Gombe State" /></div>
              {isLetter && <><div className="space-y-1.5 sm:col-span-2"><Label>Subject / reference</Label><Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Subject of letter" /></div><div className="space-y-1.5 sm:col-span-2"><Label>Letter content</Label><Textarea rows={12} value={form.body} onChange={(e) => set('body', e.target.value)} placeholder="Write your full letter here. Long letters are split over A4 pages." /></div></>}
            </CardContent>
          </Card>

          {!isLetter && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><FileText className="h-4 w-4" /> Items / goods</CardTitle>
                <p className="text-sm text-muted-foreground">{isDelivery ? 'List goods and quantities for delivery.' : 'Each line total is calculated automatically from quantity × unit price.'}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {form.items.map((item, index) => (
                  <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_82px_125px_36px]">
                    <div className="space-y-1"><Label className="text-xs">Item / goods description</Label><Input value={item.description} onChange={(e) => setItem(index, { description: e.target.value })} placeholder="e.g. 1.5kVA inverter" /></div>
                    <div className="space-y-1"><Label className="text-xs">Qty</Label><Input inputMode="decimal" value={item.quantity} onChange={(e) => setItem(index, { quantity: e.target.value.replace(/[^\d.]/g, '') })} /></div>
                    <div className="space-y-1"><Label className="text-xs">Unit price (₦)</Label><Input inputMode="decimal" disabled={isDelivery} value={item.unitPrice} onChange={(e) => setItem(index, { unitPrice: e.target.value.replace(/[^\d.]/g, '') })} placeholder="0.00" /></div>
                    <div className="flex items-end"><Button size="icon" variant="ghost" className="h-9 w-9 text-destructive" disabled={form.items.length === 1} onClick={() => set('items', form.items.filter((_, i) => i !== index))} aria-label="Remove line item"><Trash2 className="h-4 w-4" /></Button></div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => set('items', [...form.items, { description: '', quantity: '1', unitPrice: '' }])}><Plus className="h-3.5 w-3.5" /> Add item</Button>
              </CardContent>
            </Card>
          )}

          {!isLetter && (
            <Card>
              <CardHeader><CardTitle className="text-base">Payment, delivery and notes</CardTitle></CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label>Payment method</Label><Select value={form.paymentMethod || 'unspecified'} onValueChange={(v) => set('paymentMethod', v === 'unspecified' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Not specified</SelectItem><SelectItem value="Cash">Cash</SelectItem><SelectItem value="Bank transfer">Bank transfer</SelectItem><SelectItem value="POS">POS</SelectItem><SelectItem value="Online payment">Online payment</SelectItem><SelectItem value="Credit">Credit / pay later</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Amount paid (₦)</Label><Input inputMode="decimal" value={form.amountPaid} onChange={(e) => set('amountPaid', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></div>
                <div className="space-y-1.5"><Label>Delivery / shipping method</Label><Select value={form.deliveryMethod || 'unspecified'} onValueChange={(v) => set('deliveryMethod', v === 'unspecified' ? '' : v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unspecified">Not specified</SelectItem><SelectItem value="Customer pickup">Customer pickup</SelectItem><SelectItem value="Dispatch rider">Dispatch rider</SelectItem><SelectItem value="Transport company">Transport company</SelectItem><SelectItem value="Waybill">Waybill / park delivery</SelectItem><SelectItem value="Courier">Courier service</SelectItem><SelectItem value="Other">Other</SelectItem></SelectContent></Select></div>
                <div className="space-y-1.5"><Label>Waybill / tracking / payment reference</Label><Input value={form.shippingReference} onChange={(e) => set('shippingReference', e.target.value)} placeholder="Optional reference" /></div>
                {!isDelivery && <><div className="space-y-1.5"><Label>Discount (₦)</Label><Input inputMode="decimal" value={form.discount} onChange={(e) => set('discount', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></div><div className="space-y-1.5"><Label>Tax / other charge (₦)</Label><Input inputMode="decimal" value={form.tax} onChange={(e) => set('tax', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></div><div className="space-y-1.5"><Label>Delivery fee (₦)</Label><Input inputMode="decimal" value={form.deliveryFee} onChange={(e) => set('deliveryFee', e.target.value.replace(/[^\d.]/g, ''))} placeholder="0.00" /></div></>}
                <div className="space-y-1.5 sm:col-span-2"><Label>Notes / warranty / terms</Label><Textarea rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes to print on the document" /></div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4 lg:sticky lg:top-5">
          <Card>
            <CardHeader><CardTitle className="text-base">Live total summary</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {!isLetter && !isDelivery ? <>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{money(totals.subtotal)}</span></div>
                {totals.discount > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Discount</span><span>−{money(totals.discount)}</span></div>}
                {totals.tax > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Tax / other charge</span><span>{money(totals.tax)}</span></div>}
                {totals.deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-muted-foreground">Delivery</span><span>{money(totals.deliveryFee)}</span></div>}
                <div className="flex justify-between border-t pt-2 font-bold"><span>Total</span><span>{money(totals.total)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Amount paid</span><span>{money(totals.amountPaid)}</span></div>
                <div className="flex justify-between text-sm font-semibold"><span>Balance</span><span>{money(totals.balance)}</span></div>
              </> : <p className="text-sm text-muted-foreground">{isLetter ? 'This creates an editable A4 letter with automatic page breaks.' : 'Delivery notes focus on goods and quantities; prices are omitted from the printed item table.'}</p>}
              <div className="space-y-1.5 pt-2"><Label>Prepared by / signature name</Label><Input value={form.signerName} onChange={(e) => set('signerName', e.target.value)} placeholder="Optional" /></div>
              <div className="space-y-1.5"><Label>Footer message</Label><Input value={form.footerNote} onChange={(e) => set('footerNote', e.target.value)} placeholder="Thank you for your business" /></div>
            </CardContent>
          </Card>

          <div className="space-y-2 rounded-xl border bg-background p-4">
            <Button className="w-full gap-2 bg-[#1F2A44] hover:bg-[#2a3a5c]" onClick={() => void createAndEdit()} disabled={saving}>{saving && action === 'edit' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Create &amp; edit document</Button>
            <Button variant="outline" className="w-full gap-2" onClick={() => void saveAndDownloadPdf()} disabled={saving}>{saving && action === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Save &amp; download PDF</Button>
            <p className="text-xs text-muted-foreground">PDFs are saved as editable projects in My Designs and recorded in Export Centre. Check the saved PDF before sending to a customer.</p>
          </div>

          <div className="flex gap-2 rounded-xl border border-dashed p-3 text-xs text-muted-foreground"><Truck className="mt-0.5 h-4 w-4 shrink-0" /> Inter-state delivery fields include destination, shipping method, waybill/tracking reference, delivery fee and customer contact.</div>
        </div>
      </div>
    </div>
  )
}

import { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { Upload, FileDown, AlertTriangle, CheckCircle2, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { todayKey } from '@/lib/dates';

type ImportMode = 'products' | 'services' | 'mixed';

type ImportRow = {
  target: 'products' | 'services';
  name: string;
  category?: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  lowStockThreshold: number;
  durationMinutes?: number;
};

type RowDraft = {
  itemType: string;
  name: string;
  category: string;
  costPrice: string;
  sellingPrice: string;
  quantity: string;
  lowStockThreshold: string;
  durationMinutes: string;
};

type FieldKey = keyof RowDraft;

type ParsedRow = {
  rowNumber: number;
  raw: Record<string, any>;
  draft: RowDraft;
  parsed?: ImportRow;
  warnings: string[];
  errors: string[];
};

interface CatalogImportPanelProps {
  onImportProducts: (rows: Array<{
    name: string;
    category?: string;
    costPrice: number;
    sellingPrice: number;
    quantity: number;
    lowStockThreshold: number;
    durationMinutes?: number;
  }>) => Promise<{ inserted: number; error: any }>;
}

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '').trim();
const headerTokens = (value: string) => value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
const csvEscape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;

const toNumber = (value: string) => {
  const parsed = Number(String(value || '').replace(/,/g, '').trim());
  return Number.isFinite(parsed) ? parsed : NaN;
};

const scoreHeader = (header: string, alias: string) => {
  const hn = normalize(header);
  const an = normalize(alias);
  if (!hn || !an) return 0;
  if (hn === an) return 100;
  if (hn.startsWith(an) || hn.includes(an) || an.includes(hn)) return 80;

  const ht = headerTokens(header);
  const at = headerTokens(alias);
  const overlap = at.filter((t) => ht.includes(t)).length;
  if (overlap >= 2) return 55 + overlap * 8;
  if (overlap === 1 && at.length === 1) return 50;
  return 0;
};

const pickValue = (row: Record<string, any>, aliases: string[]) => {
  let best: { value: any; score: number } = { value: undefined, score: 0 };
  for (const [header, value] of Object.entries(row)) {
    for (const alias of aliases) {
      const s = scoreHeader(header, alias);
      if (s > best.score) best = { value, score: s };
    }
  }
  return best.score >= 50 ? best.value : undefined;
};

const FIELD_ALIASES: Record<FieldKey, string[]> = {
  itemType: ['item_type', 'type', 'offering_type', 'catalog_type'],
  name: ['name', 'item_name', 'product_name', 'service_name', 'item', 'description'],
  category: ['category', 'group', 'department', 'class'],
  costPrice: ['cost_price', 'buying_price', 'purchase_price', 'buy_price', 'cost', 'unit_cost', 'direct_cost', 'cost_per_service'],
  sellingPrice: ['selling_price', 'sell_price', 'sales_price', 'retail_price', 'price', 'service_price'],
  quantity: ['quantity', 'qty', 'stock_level', 'stock', 'opening_stock', 'capacity', 'units'],
  lowStockThreshold: ['low_stock_threshold', 'min_stock_level', 'reorder_level', 'reorder_point', 'min_capacity_level'],
  durationMinutes: ['duration_minutes', 'duration', 'minutes', 'service_duration'],
};

const parseDraft = (rowNumber: number, draft: RowDraft) => {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = draft.name.trim();
  const category = draft.category.trim();
  const costPriceNum = toNumber(draft.costPrice);
  const sellingPriceNum = toNumber(draft.sellingPrice);
  const quantityNum = toNumber(draft.quantity);
  const lowThresholdNum = toNumber(draft.lowStockThreshold);
  const durationNum = toNumber(draft.durationMinutes);

  const target: 'products' = 'products';
  const itemType = draft.itemType.toLowerCase().trim();

  if (!name) errors.push('Missing name.');
  if (!Number.isFinite(sellingPriceNum) || sellingPriceNum <= 0) errors.push('Missing or invalid selling/price.');
  if (!Number.isFinite(quantityNum) || quantityNum < 0) errors.push('Missing or invalid quantity/capacity.');
  if (!Number.isFinite(costPriceNum) || costPriceNum <= 0) warnings.push('Cost price is missing/zero (recommended to set).');
  if (!category) warnings.push('Category is missing.');

  const parsed: ImportRow | undefined = errors.length === 0 ? {
    target,
    name,
    category: category || undefined,
    costPrice: Number.isFinite(costPriceNum) ? Math.max(0, costPriceNum) : 0,
    sellingPrice: Math.max(0, sellingPriceNum),
    quantity: Math.max(0, Math.floor(quantityNum)),
    lowStockThreshold: Number.isFinite(lowThresholdNum) ? Math.max(0, Math.floor(lowThresholdNum)) : 5,
    durationMinutes: 0,
  } : undefined;

  return { parsed, errors, warnings };
};

const parseRawRowToDraft = (
  raw: Record<string, any>,
  mappedHeaders?: Partial<Record<FieldKey, string>>
): RowDraft => {
  const getField = (field: FieldKey) => {
    const mappedHeader = mappedHeaders?.[field];
    if (mappedHeader && Object.prototype.hasOwnProperty.call(raw, mappedHeader)) {
      return raw[mappedHeader];
    }
    return pickValue(raw, FIELD_ALIASES[field]);
  };

  return {
    itemType: String(getField('itemType') || '').trim(),
    name: String(getField('name') || '').trim(),
    category: String(getField('category') || '').trim(),
    costPrice: String(getField('costPrice') || '').trim(),
    sellingPrice: String(getField('sellingPrice') || '').trim(),
    quantity: String(getField('quantity') || '').trim(),
    lowStockThreshold: String(getField('lowStockThreshold') || '').trim(),
    durationMinutes: String(getField('durationMinutes') || '').trim(),
  };
};

export function CatalogImportPanel({ onImportProducts }: CatalogImportPanelProps) {
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [availableHeaders, setAvailableHeaders] = useState<string[]>([]);
  const [columnMap, setColumnMap] = useState<Partial<Record<FieldKey, string>>>({});
  const [isParsing, setIsParsing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [defaultCost, setDefaultCost] = useState('');
  const [defaultSelling, setDefaultSelling] = useState('');
  const [defaultQty, setDefaultQty] = useState('');
  const [defaultNamePrefix, setDefaultNamePrefix] = useState('Imported Item');

  const validRows = useMemo(() => rows.filter((r) => r.parsed && r.errors.length === 0) as Array<ParsedRow & { parsed: ImportRow }>, [rows]);
  const failedRows = useMemo(() => rows.filter((r) => r.errors.length > 0), [rows]);
  const errorCount = useMemo(() => rows.reduce((sum, r) => sum + r.errors.length, 0), [rows]);
  const warningCount = useMemo(() => rows.reduce((sum, r) => sum + r.warnings.length, 0), [rows]);

  const buildRow = (raw: Record<string, any>, rowNumber: number, draftOverride?: Partial<RowDraft>): ParsedRow => {
    const baseDraft = parseRawRowToDraft(raw, columnMap);
    const draft = { ...baseDraft, ...(draftOverride || {}) };
    const evaluated = parseDraft(rowNumber, draft);
    return {
      rowNumber,
      raw,
      draft,
      parsed: evaluated.parsed,
      warnings: evaluated.warnings,
      errors: evaluated.errors,
    };
  };

  const parseWorkbook = async (file: File) => {
    setIsParsing(true);
    setRows([]);
    setFileName(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
      const headers = Array.from(new Set(jsonRows.flatMap((row) => Object.keys(row))));
      setAvailableHeaders(headers);
      setColumnMap({});
      setRows(jsonRows.map((raw, i) => buildRow(raw, i + 2)));
    } finally {
      setIsParsing(false);
    }
  };

  const rebuildRowsWithMapping = (nextMap: Partial<Record<FieldKey, string>>) => {
    setRows((prev) => prev.map((row) => {
      const baseDraft = parseRawRowToDraft(row.raw, nextMap);
      return buildRow(row.raw, row.rowNumber, baseDraft);
    }));
  };

  const updateColumnMapping = (field: FieldKey, header: string) => {
    const next = { ...columnMap, [field]: header || undefined };
    setColumnMap(next);
    rebuildRowsWithMapping(next);
  };

  const updateDraftField = (rowNumber: number, field: keyof RowDraft, value: string) => {
    setRows((prev) => prev.map((row) => {
      if (row.rowNumber !== rowNumber) return row;
      return buildRow(row.raw, row.rowNumber, { ...row.draft, [field]: value });
    }));
  };

  const applyDefaultsToMissing = () => {
    const fallbackCost = toNumber(defaultCost);
    const fallbackSelling = toNumber(defaultSelling);
    const fallbackQty = toNumber(defaultQty);
    const prefix = defaultNamePrefix.trim() || 'Imported Item';

    setRows((prev) => prev.map((row) => {
      const nextDraft: RowDraft = { ...row.draft };
      if (!nextDraft.name.trim()) nextDraft.name = `${prefix} ${row.rowNumber}`;
      if ((!Number.isFinite(toNumber(nextDraft.costPrice)) || toNumber(nextDraft.costPrice) <= 0) && Number.isFinite(fallbackCost) && fallbackCost > 0) {
        nextDraft.costPrice = String(fallbackCost);
      }
      if ((!Number.isFinite(toNumber(nextDraft.sellingPrice)) || toNumber(nextDraft.sellingPrice) <= 0) && Number.isFinite(fallbackSelling) && fallbackSelling > 0) {
        nextDraft.sellingPrice = String(fallbackSelling);
      }
      if ((!Number.isFinite(toNumber(nextDraft.quantity)) || toNumber(nextDraft.quantity) < 0) && Number.isFinite(fallbackQty) && fallbackQty >= 0) {
        nextDraft.quantity = String(Math.floor(fallbackQty));
      }
      if (!nextDraft.lowStockThreshold.trim()) nextDraft.lowStockThreshold = '5';
      return buildRow(row.raw, row.rowNumber, nextDraft);
    }));
  };

  const importValidRows = async () => {
    if (validRows.length === 0) return;
    setIsImporting(true);
    try {
      const productRows = validRows.filter((r) => r.parsed.target === 'products').map((r) => r.parsed);
      setRows((prev) => {
        const remaining = prev.filter((row) => row.errors.length > 0);
        if (remaining.length === 0) setFileName('');
        return remaining;
      });
    } finally {
      setIsImporting(false);
    }
  };

  const downloadFailedRowsCsv = () => {
    if (failedRows.length === 0) return;
    const headers = ['row_number', 'name', 'category', 'cost_price', 'selling_price', 'quantity', 'low_stock_threshold', 'duration_minutes', 'errors', 'warnings'];
    const lines = failedRows.map((row) => [
      row.rowNumber,
      row.draft.name,
      row.draft.category,
      row.draft.costPrice,
      row.draft.sellingPrice,
      row.draft.quantity,
      row.draft.lowStockThreshold,
      row.draft.durationMinutes,
      row.errors.join(' | '),
      row.warnings.join(' | '),
    ].map(csvEscape).join(','));
    const csv = [headers.join(','), ...lines].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dukakonnect-import-failed-rows-${todayKey()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const downloadTemplate = () => {
    const headers = ['name', 'category', 'cost_price', 'selling_price', 'quantity', 'low_stock_threshold'];
    const sample = ['Unga wa Ngano (2kg)', 'Flour', '65', '80', '20', '5'];
    const csv = `${headers.join(',')}\n${sample.join(',')}\n`;
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'duka-import-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="sheet p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">Catalog Import</h3>
          <p className="text-xs text-muted-foreground">Upload CSV/XLSX and fix missing fields before import.</p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <FileDown className="h-4 w-4 mr-2" />
          Template
        </Button>
      </div>

      <Input
        type="file"
        accept=".csv,.xlsx,.xls"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          parseWorkbook(file);
          e.currentTarget.value = '';
        }}
      />

      {isParsing && <p className="text-sm text-muted-foreground">Parsing file...</p>}
      {fileName && !isParsing && (
        <div className="rounded-xl border border-border p-3 text-sm space-y-1">
          <p className="font-medium">{fileName}</p>
          <p className="text-muted-foreground">
            Rows: {rows.length} | Ready: {validRows.length} | Warnings: {warningCount} | Errors: {errorCount}
          </p>
        </div>
      )}

      {availableHeaders.length > 0 && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-medium">Column Mapping (Optional Override)</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {[
              { key: 'name', label: 'Name' },
              { key: 'costPrice', label: 'Cost Price' },
              { key: 'sellingPrice', label: 'Selling Price' },
              { key: 'quantity', label: 'Quantity/Capacity' },
              { key: 'category', label: 'Category' },
              { key: 'lowStockThreshold', label: 'Low Stock Threshold' },
                      { key: 'itemType', label: 'Item Type (mixed)' },
            ].map((field) => (
              <label key={field.key} className="space-y-1">
                <span className="text-muted-foreground">{field.label}</span>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                  value={columnMap[field.key as FieldKey] || ''}
                  onChange={(e) => updateColumnMapping(field.key as FieldKey, e.target.value)}
                >
                  <option value="">Auto-detect</option>
                  {availableHeaders.map((header) => (
                    <option key={`${field.key}-${header}`} value={header}>{header}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <div className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-xs font-medium">Defaults for Missing Fields</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Name prefix" value={defaultNamePrefix} onChange={(e) => setDefaultNamePrefix(e.target.value)} />
            <Input type="number" placeholder="Default cost" value={defaultCost} onChange={(e) => setDefaultCost(e.target.value)} />
            <Input type="number" placeholder="Default selling" value={defaultSelling} onChange={(e) => setDefaultSelling(e.target.value)} />
            <Input type="number" placeholder="Default quantity" value={defaultQty} onChange={(e) => setDefaultQty(e.target.value)} />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={applyDefaultsToMissing}>
            <Wand2 className="h-4 w-4 mr-2" />
            Apply Defaults to Missing
          </Button>
        </div>
      )}

      {rows.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-auto pr-1">
          {rows.slice(0, 16).map((row) => (
            <div key={row.rowNumber} className="rounded-lg border border-border p-2 text-xs space-y-2">
              <p className="font-medium">Row {row.rowNumber}: {row.parsed?.name || row.draft.name || 'Needs review'}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="Name" value={row.draft.name} onChange={(e) => updateDraftField(row.rowNumber, 'name', e.target.value)} />
                <Input type="number" placeholder="Cost" value={row.draft.costPrice} onChange={(e) => updateDraftField(row.rowNumber, 'costPrice', e.target.value)} />
                <Input type="number" placeholder="Selling" value={row.draft.sellingPrice} onChange={(e) => updateDraftField(row.rowNumber, 'sellingPrice', e.target.value)} />
                <Input type="number" placeholder="Qty/Capacity" value={row.draft.quantity} onChange={(e) => updateDraftField(row.rowNumber, 'quantity', e.target.value)} />
              </div>
              {row.errors.map((e, idx) => (
                <p key={`e-${idx}`} className="text-destructive flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {e}</p>
              ))}
              {row.warnings.map((w, idx) => (
                <p key={`w-${idx}`} className="text-warning flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> {w}</p>
              ))}
              {row.errors.length === 0 && (
                <p className="text-success flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Ready</p>
              )}
            </div>
          ))}
          {rows.length > 16 && <p className="text-xs text-muted-foreground">Showing first 16 rows...</p>}
        </div>
      )}

      <Button className="w-full" onClick={importValidRows} disabled={validRows.length === 0 || isImporting}>
        <Upload className="h-4 w-4 mr-2" />
        {isImporting ? 'Importing...' : `Import ${validRows.length} Ready Rows`}
      </Button>
      {failedRows.length > 0 && (
        <Button type="button" variant="outline" className="w-full" onClick={downloadFailedRowsCsv}>
          <FileDown className="h-4 w-4 mr-2" />
          Download Failed Rows CSV ({failedRows.length})
        </Button>
      )}
    </div>
  );
}

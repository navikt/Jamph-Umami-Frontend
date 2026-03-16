import { useState, useRef } from 'react';
import { Modal, Button, CopyButton } from '@navikt/ds-react';
import { Download, ArrowLeft } from 'lucide-react';
import { utils as XLSXUtils, write as XLSXWrite } from 'xlsx';
import { translateValue } from '../../../lib/translations';
import { encode } from '@toon-format/toon';
import * as htmlToImage from 'html-to-image';
import { LineChart, VerticalBarChart, PieChart, AreaChart } from '@fluentui/react-charting';

const COL_PX = 600;
const ROW_PX = 400;

interface PngSize { cols: number; rows: number; name: string; }

interface DownloadResultsModalProps {
  result: any;
  open: boolean;
  onClose: () => void;
  chartType?: string;
  pngSizes?: PngSize[];
  title?: string;
  prepareLineChartData?: (includeAverage?: boolean) => any;
  prepareBarChartData?: () => any;
  preparePieChartData?: () => any;
}

const DownloadResultsModal = ({
  result, open, onClose,
  chartType, pngSizes, title,
  prepareLineChartData, prepareBarChartData, preparePieChartData,
}: DownloadResultsModalProps) => {
  const [previewSize, setPreviewSize] = useState<PngSize | null>(null);
  const [capturing, setCapturing] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const handleClose = () => { setPreviewSize(null); onClose(); };

  const downloadPng = () => {
    if (!chartRef.current || !previewSize) return;
    setCapturing(true);
    const width = previewSize.cols * COL_PX;
    const height = previewSize.rows * ROW_PX;
    const ts = new Date().toISOString().replaceAll(/[:.]/g, '-').slice(0, 19);
    const safeTitle = (title ?? 'chart').replaceAll(/[^a-z0-9æøå]/gi, '_').slice(0, 60);
    const safeSizeName = previewSize.name.replaceAll(/[^a-z0-9]/gi, '_');
    htmlToImage.toPng(chartRef.current, { width, height, backgroundColor: '#ffffff' })
      .then((dataUrl) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `${safeTitle}_${safeSizeName}_${ts}.png`;
        link.click();
      })
      .finally(() => setCapturing(false));
  };

  const buildChartEl = (size: PngSize) => {
    const w = size.cols * COL_PX;
    const h = size.rows * ROW_PX;
    if (chartType === 'linechart' && prepareLineChartData) {
      const data = prepareLineChartData(false);
      if (data) return <LineChart data={data.data} width={w} height={h} margins={{ left: 50, right: 40, top: 20, bottom: 35 }} />;
    }
    if (chartType === 'areachart' && prepareLineChartData) {
      const data = prepareLineChartData(false);
      if (data) return <AreaChart data={data.data} width={w} height={h} margins={{ left: 50, right: 50, top: 20, bottom: 35 }} />;
    }
    if (chartType === 'barchart' && prepareBarChartData) {
      const data = prepareBarChartData();
      if (data) {
        let displayData = Array.isArray(data.data) ? data.data : [];
        if (displayData.length > 12) {
          const top11 = displayData.slice(0, 11);
          const otherSum = displayData.slice(11).reduce((s: number, it: any) => s + (it.y || 0), 0);
          displayData = [...top11, { x: 'Andre', y: otherSum }];
        }
        return <VerticalBarChart data={displayData} width={w} height={h} barWidth={data.barWidth} margins={{ left: 50, right: 40, top: 20, bottom: 35 }} />;
      }
    }
    if (chartType === 'piechart' && preparePieChartData) {
      const data = preparePieChartData();
      if (data) {
        let displayData = Array.isArray(data.data) ? data.data : [];
        if (displayData.length > 12) {
          const top11 = displayData.slice(0, 11);
          const otherSum = displayData.slice(11).reduce((s: number, it: any) => s + (it.y || 0), 0);
          displayData = [...top11, { x: 'Andre', y: otherSum }];
        }
        return <PieChart data={displayData} width={w} height={h} chartTitle="" />;
      }
    }
    return null;
  };
  // ── CSV / Excel / JSON / TOON helpers ────────────────────────────────────
  const getCSVContent = () => {
    if (!result?.data?.length) return '';
    const headers = Object.keys(result.data[0]);
    const rows = [
      headers.join(','),
      ...result.data.map((row: any) =>
        headers.map((h) => {
          const v = String(translateValue(h, row[h]) ?? '');
          return v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.split('"').join('""')}"` : v;
        }).join(',')
      ),
    ];
    return rows.join('\n');
  };

  const getJSONContent = () => {
    if (!result?.data?.length) return '';
    return JSON.stringify(result.data.map((row: any) => {
      const t: any = {};
      Object.keys(row).forEach((k) => { t[k] = translateValue(k, row[k]); });
      return t;
    }), null, 2);
  };

  const getTOONContent = () => {
    if (!result?.data?.length) return '';
    return encode(result.data.map((row: any) => {
      const t: any = {};
      Object.keys(row).forEach((k) => { t[k] = translateValue(k, row[k]); });
      return t;
    }));
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const date = new Date().toISOString().slice(0, 10);

  // ── PNG preview mode ─────────────────────────────────────────────────────
  if (previewSize) {
    const w = previewSize.cols * COL_PX;
    const h = previewSize.rows * ROW_PX;
    const chartEl = buildChartEl(previewSize);
    return (
      <Modal open={open} onClose={handleClose} header={{ heading: `PNG – ${previewSize.name} (${w}×${h}px)` }} width="medium">
        <Modal.Body>
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh', background: '#f0f0f0', padding: 8 }}>
            <div ref={chartRef} className="widget-card" style={{ width: w, height: h }}>
              {title && (
                <div className="widget-header">
                  <span className="widget-title">{title}</span>
                </div>
              )}
              <div className="widget-body">
                {chartEl ?? <div style={{ padding: 24, color: '#888' }}>Ingen forhåndsvisning tilgjengelig.</div>}
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" size="small" icon={<ArrowLeft size={16} />} onClick={() => setPreviewSize(null)}>Tilbake</Button>
          <Button variant="primary" size="small" icon={<Download size={16} />} onClick={downloadPng} loading={capturing}>Last ned PNG</Button>
        </Modal.Footer>
      </Modal>
    );
  }

  const downloadCSV = () => {
    const content = getCSVContent();
    if (!content) return;
    triggerDownload(new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }), `query_results_${date}.csv`);
  };

  const downloadExcel = () => {
    if (!result?.data?.length) return;
    const headers = Object.keys(result.data[0]);
    const ws = XLSXUtils.aoa_to_sheet([
      headers,
      ...result.data.map((row: any) => headers.map((h) => translateValue(h, row[h]) ?? '')),
    ]);
    const wb = XLSXUtils.book_new();
    XLSXUtils.book_append_sheet(wb, ws, 'Query Results');
    triggerDownload(
      new Blob([XLSXWrite(wb, { bookType: 'xlsx', type: 'array' })], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `query_results_${date}.xlsx`
    );
  };

  const downloadJSON = () => {
    const content = getJSONContent();
    if (!content) return;
    triggerDownload(new Blob([content], { type: 'application/json;charset=utf-8;' }), `query_results_${date}.json`);
  };

  const downloadTOON = () => {
    const content = getTOONContent();
    if (!content) return;
    triggerDownload(new Blob([content], { type: 'text/plain;charset=utf-8;' }), `query_results_${date}.toon`);
  };

  // ── Main download options ─────────────────────────────────────────────────
  return (
    <Modal open={open} onClose={handleClose} header={{ heading: 'Last ned resultater' }}>
      <Modal.Body>
        <div className="space-y-4">
          {pngSizes && pngSizes.length > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Last ned som PNG:</p>
              <div className="flex gap-2 flex-wrap">
                {pngSizes.map((s) => (
                  <Button key={s.name} onClick={() => setPreviewSize(s)} variant="secondary" size="small" icon={<Download size={16} />}>{s.name}</Button>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Last ned som fil:</p>
            <div className="flex gap-2 flex-wrap">
              <Button onClick={downloadCSV} variant="secondary" size="small" icon={<Download size={16} />}>CSV</Button>
              <Button onClick={downloadExcel} variant="secondary" size="small" icon={<Download size={16} />}>Excel</Button>
              <Button onClick={downloadJSON} variant="secondary" size="small" icon={<Download size={16} />}>JSON</Button>
              <Button onClick={downloadTOON} variant="secondary" size="small" icon={<Download size={16} />}>TOON</Button>
            </div>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Eller kopier innholdet:</p>
            <div className="flex gap-2 flex-wrap">
              <CopyButton copyText={getCSVContent()} text="CSV" activeText="CSV kopiert!" size="small" />
              <CopyButton copyText={getJSONContent()} text="JSON" activeText="JSON kopiert!" size="small" />
              <CopyButton copyText={getTOONContent()} text="TOON" activeText="TOON kopiert!" size="small" />
            </div>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
};

export default DownloadResultsModal;

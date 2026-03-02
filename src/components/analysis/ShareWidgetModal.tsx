import { useState } from 'react';
import { Modal, Button, TextField } from '@navikt/ds-react';
import { Check } from 'lucide-react';
import PinnedWidget from '../dashboard/PinnedWidget';

interface WidgetSize { cols: number; rows: number; name: string; }

interface ShareWidgetModalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly sql: string;
  readonly chartType: string;
  readonly defaultTitle: string;
  readonly sizes: WidgetSize[];
  readonly result?: any;
}

export default function ShareWidgetModal({ open, onClose, sql, chartType, defaultTitle, sizes, result }: ShareWidgetModalProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [selectedSize, setSelectedSize] = useState<WidgetSize>(sizes[0]);
  const [urlCopied, setUrlCopied] = useState(false);
  const [metabaseCopied, setMetabaseCopied] = useState(false);

  const buildUrl = () => {
    const params = new URLSearchParams({
      sql,
      chartType,
      title,
      cols: String(selectedSize.cols),
      rows: String(selectedSize.rows),
    });
    return `${globalThis.location.origin}/widget?${params.toString()}`;
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setUrlCopied(true);
      setTimeout(() => setUrlCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const copyForMetabase = async () => {
    try {
      await navigator.clipboard.writeText(sql);
      setMetabaseCopied(true);
      setTimeout(() => setMetabaseCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <Modal open={open} onClose={onClose} header={{ heading: 'Del widget' }}>
      <Modal.Body>
        <div className="space-y-5">
          <TextField
            label="Tittel"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            size="small"
          />

          {result && (
            <div style={{ height: 240, position: 'relative', borderRadius: 6, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
              <PinnedWidget result={result} chartType={chartType} title={title} colSpan={selectedSize.cols} rowSpan={selectedSize.rows} />
            </div>
          )}

          <div>
            <p className="navds-label navds-form-field__label mb-2">Størrelse</p>
            <div className="flex gap-2 flex-wrap">
              {sizes.map((s) => (
                <Button
                  key={s.name}
                  size="small"
                  variant={selectedSize.name === s.name ? 'primary' : 'secondary'}
                  onClick={() => setSelectedSize(s)}
                >
                  {s.name} ({s.cols}×{s.rows})
                </Button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 flex-wrap pt-1">
            <Button
              size="small"
              variant="secondary"
              icon={urlCopied ? <Check size={16} /> : undefined}
              onClick={copyUrl}
            >
              {urlCopied ? 'Kopiert!' : 'Kopier delbar lenke'}
            </Button>
            <Button
              size="small"
              variant="secondary"
              icon={metabaseCopied ? <Check size={16} /> : undefined}
              onClick={copyForMetabase}
            >
              {metabaseCopied ? 'Kopiert!' : 'Kopier for Metabase'}
            </Button>
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="tertiary" size="small" onClick={onClose}>Lukk</Button>
      </Modal.Footer>
    </Modal>
  );
}

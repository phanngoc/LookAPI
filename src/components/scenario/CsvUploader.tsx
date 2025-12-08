import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

interface CsvPreview {
  headers: string[];
  rows: string[][];
  totalRows: number;
}

interface CsvUploaderProps {
  onCsvSelected: (config: CsvConfig) => void;
  currentConfig?: CsvConfig;
}

export interface CsvConfig {
  fileName: string;
  quoteChar?: string;
  delimiter?: string;
}

export const CsvUploader: React.FC<CsvUploaderProps> = ({ onCsvSelected, currentConfig }) => {
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [filePath, setFilePath] = useState<string>(currentConfig?.fileName || '');
  const [quoteChar, setQuoteChar] = useState<string>(currentConfig?.quoteChar || '"');
  const [delimiter, setDelimiter] = useState<string>(currentConfig?.delimiter || ',');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'CSV',
            extensions: ['csv']
          }
        ]
      });

      if (selected && typeof selected === 'string') {
        setFilePath(selected);
        await loadPreview(selected, quoteChar, delimiter);
      }
    } catch (err) {
      setError(`Failed to select file: ${err}`);
    }
  };

  const loadPreview = async (path: string, quote: string, delim: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<CsvPreview>('preview_csv_file', {
        filePath: path,
        quoteChar: quote || null,
        delimiter: delim || null
      });
      setPreview(result);
      
      // Notify parent component
      onCsvSelected({
        fileName: path,
        quoteChar: quote,
        delimiter: delim
      });
    } catch (err) {
      setError(`Failed to load CSV: ${err}`);
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigChange = () => {
    if (filePath) {
      loadPreview(filePath, quoteChar, delimiter);
    }
  };

  return (
    <div className="csv-uploader">
      <div className="csv-config">
        <div className="form-group">
          <label>CSV File:</label>
          <div className="input-group">
            <input
              type="text"
              value={filePath}
              readOnly
              placeholder="Select a CSV file..."
              className="form-control"
            />
            <button onClick={handleFileSelect} className="btn btn-secondary">
              Browse...
            </button>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Quote Character:</label>
            <input
              type="text"
              value={quoteChar}
              onChange={(e) => setQuoteChar(e.target.value)}
              onBlur={handleConfigChange}
              maxLength={1}
              className="form-control"
              placeholder='"'
            />
          </div>

          <div className="form-group">
            <label>Delimiter:</label>
            <input
              type="text"
              value={delimiter}
              onChange={(e) => setDelimiter(e.target.value)}
              onBlur={handleConfigChange}
              maxLength={1}
              className="form-control"
              placeholder=","
            />
          </div>
        </div>
      </div>

      {loading && <div className="loading">Loading preview...</div>}
      
      {error && <div className="error alert alert-danger">{error}</div>}

      {preview && (
        <div className="csv-preview">
          <h4>Preview ({preview.totalRows} rows total, showing first {preview.rows.length})</h4>
          
          <div className="preview-info">
            <p><strong>Available columns:</strong></p>
            <div className="columns-list">
              {preview.headers.map((header, idx) => (
                <code key={idx} className="column-badge">
                  {'{{ item.' + header + ' }}'}
                </code>
              ))}
              <code className="column-badge">{'{{ index }}'}</code>
            </div>
          </div>

          <div className="table-container">
            <table className="table table-bordered table-sm">
              <thead>
                <tr>
                  <th>#</th>
                  {preview.headers.map((header, idx) => (
                    <th key={idx}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    <td>{rowIdx}</td>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
        .csv-uploader {
          padding: 1rem;
          border: 1px solid #dee2e6;
          border-radius: 0.25rem;
          background: #f8f9fa;
        }

        .csv-config {
          margin-bottom: 1rem;
        }

        .form-group {
          margin-bottom: 1rem;
        }

        .form-group label {
          display: block;
          margin-bottom: 0.25rem;
          font-weight: 600;
          color: #495057;
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }

        .input-group {
          display: flex;
          gap: 0.5rem;
        }

        .input-group input {
          flex: 1;
        }

        .form-control {
          padding: 0.375rem 0.75rem;
          border: 1px solid #ced4da;
          border-radius: 0.25rem;
          font-size: 0.875rem;
        }

        .btn {
          padding: 0.375rem 0.75rem;
          border: 1px solid transparent;
          border-radius: 0.25rem;
          cursor: pointer;
          font-size: 0.875rem;
        }

        .btn-secondary {
          background-color: #6c757d;
          color: white;
        }

        .btn-secondary:hover {
          background-color: #5a6268;
        }

        .loading {
          padding: 1rem;
          text-align: center;
          color: #6c757d;
        }

        .error {
          padding: 0.75rem;
          margin-bottom: 1rem;
          border-radius: 0.25rem;
        }

        .alert-danger {
          background-color: #f8d7da;
          border: 1px solid #f5c6cb;
          color: #721c24;
        }

        .csv-preview {
          margin-top: 1rem;
        }

        .csv-preview h4 {
          font-size: 1rem;
          margin-bottom: 0.5rem;
          color: #495057;
        }

        .preview-info {
          margin-bottom: 1rem;
          padding: 0.75rem;
          background: white;
          border-radius: 0.25rem;
        }

        .preview-info p {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
        }

        .columns-list {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .column-badge {
          padding: 0.25rem 0.5rem;
          background: #e9ecef;
          border: 1px solid #dee2e6;
          border-radius: 0.25rem;
          font-size: 0.75rem;
          font-family: 'Courier New', monospace;
        }

        .table-container {
          overflow-x: auto;
          background: white;
          border-radius: 0.25rem;
        }

        .table {
          width: 100%;
          margin-bottom: 0;
          border-collapse: collapse;
        }

        .table-bordered {
          border: 1px solid #dee2e6;
        }

        .table-sm th,
        .table-sm td {
          padding: 0.5rem;
          font-size: 0.875rem;
          border: 1px solid #dee2e6;
        }

        .table thead th {
          background-color: #e9ecef;
          font-weight: 600;
          color: #495057;
        }

        .table tbody tr:hover {
          background-color: #f8f9fa;
        }
      `}</style>
    </div>
  );
};

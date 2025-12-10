import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react';

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
  const [success, setSuccess] = useState(false);

  // Load preview when currentConfig changes
  useEffect(() => {
    if (currentConfig?.fileName && filePath === currentConfig.fileName) {
      loadPreview(currentConfig.fileName, currentConfig.quoteChar || '"', currentConfig.delimiter || ',');
    }
  }, [currentConfig]);

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
    if (!path) {
      setError('Please select a CSV file first');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);
    try {
      const result = await invoke<CsvPreview>('preview_csv_file', {
        filePath: path,
        quoteChar: quote || null,
        delimiter: delim || null
      });
      
      if (!result || !result.headers || result.headers.length === 0) {
        setError('CSV file appears to be empty or invalid');
        setPreview(null);
        return;
      }

      setPreview(result);
      setSuccess(true);
      
      // Notify parent component
      onCsvSelected({
        fileName: path,
        quoteChar: quote,
        delimiter: delim
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to load CSV: ${errorMessage}`);
      setPreview(null);
      setSuccess(false);
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
    <div className="space-y-4">
      {/* File Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-slate-600">CSV File</label>
        <div className="flex gap-2">
          <Input
            type="text"
            value={filePath}
            readOnly
            placeholder="Select a CSV file..."
            className="flex-1 font-mono text-xs"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleFileSelect}
            disabled={loading}
          >
            <FileSpreadsheet className="w-3 h-3 mr-1" />
            Browse...
          </Button>
        </div>
      </div>

      {/* CSV Configuration */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Quote Character</label>
          <Input
            type="text"
            value={quoteChar}
            onChange={(e) => {
              const val = e.target.value.slice(0, 1);
              setQuoteChar(val);
            }}
            onBlur={handleConfigChange}
            maxLength={1}
            placeholder='"'
            className="font-mono text-xs"
            disabled={loading || !filePath}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-600">Delimiter</label>
          <Input
            type="text"
            value={delimiter}
            onChange={(e) => {
              const val = e.target.value.slice(0, 1);
              setDelimiter(val);
            }}
            onBlur={handleConfigChange}
            maxLength={1}
            placeholder=","
            className="font-mono text-xs"
            disabled={loading || !filePath}
          />
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading CSV preview...</span>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-800">{error}</p>
        </div>
      )}

      {/* Success State */}
      {success && preview && !loading && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-emerald-800">
            CSV loaded successfully: <strong>{preview.totalRows}</strong> rows, <strong>{preview.headers.length}</strong> columns
          </p>
        </div>
      )}

      {/* Preview Section */}
      {preview && !loading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-slate-900">
              CSV Preview
            </h4>
            <Badge variant="outline" className="text-xs">
              {preview.totalRows} rows • {preview.headers.length} columns
            </Badge>
          </div>

          {/* Available Variables */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-xs font-medium text-slate-700 mb-2">Available Variables:</p>
            <div className="flex flex-wrap gap-1.5">
              {preview.headers.map((header, idx) => (
                <Badge key={idx} variant="outline" className="text-xs font-mono bg-white">
                  {'{{ item.' + header + ' }}'}
                </Badge>
              ))}
              <Badge variant="outline" className="text-xs font-mono bg-white">
                {'{{ index }}'}
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Use these variables in your request URL, headers, or body
            </p>
          </div>

          {/* Preview Table */}
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto max-h-64">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-slate-100 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-medium text-slate-700 border-b border-slate-200">
                      #
                    </th>
                    {preview.headers.map((header, idx) => (
                      <th
                        key={idx}
                        className="px-2 py-1.5 text-left font-medium text-slate-700 border-b border-slate-200"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {preview.rows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-slate-50">
                      <td className="px-2 py-1.5 text-slate-500 font-medium">
                        {rowIdx}
                      </td>
                      {row.map((cell, cellIdx) => (
                        <td
                          key={cellIdx}
                          className="px-2 py-1.5 text-slate-600 max-w-[200px] truncate"
                          title={cell}
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.totalRows > preview.rows.length && (
              <div className="px-3 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 text-center">
                Showing first {preview.rows.length} of {preview.totalRows} rows
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

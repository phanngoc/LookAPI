import Editor, { OnMount } from '@monaco-editor/react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: string;
  height?: string | number;
  readOnly?: boolean;
  className?: string;
  minimap?: boolean;
  lineNumbers?: boolean;
}

export function CodeEditor({
  value,
  onChange,
  language = 'json',
  height = '300px',
  readOnly = false,
  className,
  minimap = false,
  lineNumbers = true,
}: CodeEditorProps) {
  const handleEditorMount: OnMount = (editor) => {
    // Format JSON on mount if the language is JSON
    if (language === 'json' && value) {
      try {
        const formatted = JSON.stringify(JSON.parse(value), null, 2);
        if (formatted !== value) {
          editor.setValue(formatted);
        }
      } catch {
        // Invalid JSON, keep original value
      }
    }
  };

  return (
    <div className={cn('rounded-lg border border-slate-200 overflow-hidden', className)}>
      <Editor
        height={height}
        language={language}
        value={value}
        onChange={(val) => onChange?.(val || '')}
        onMount={handleEditorMount}
        theme="vs"
        options={{
          readOnly,
          minimap: { enabled: minimap },
          lineNumbers: lineNumbers ? 'on' : 'off',
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          tabSize: 2,
          automaticLayout: true,
          wordWrap: 'on',
          folding: true,
          renderLineHighlight: 'line',
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          padding: { top: 12, bottom: 12 },
          overviewRulerBorder: false,
          hideCursorInOverviewRuler: true,
        }}
      />
    </div>
  );
}


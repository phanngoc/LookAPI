import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { APIResponseDefinition, ResponseProperty } from '@/types/api';
import { CheckCircle2, XCircle, FileJson } from 'lucide-react';

interface ResponseSchemaViewerProps {
  responses?: APIResponseDefinition[];
}

const PropertyRow = ({ prop, level = 0 }: { prop: ResponseProperty; level?: number }) => {
  const indent = level * 16;
  
  return (
    <div>
      <div className="flex items-center gap-2 py-2 px-3 hover:bg-slate-50 border-b border-slate-100">
        <div style={{ paddingLeft: `${indent}px` }} className="flex-1 flex items-center gap-2">
          <code className="text-sm font-mono text-blue-600">{prop.name}</code>
          <Badge variant="outline" className="text-xs">
            {prop.propertyType}
          </Badge>
          {prop.required ? (
            <Badge variant="destructive" className="text-xs">Required</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs">Optional</Badge>
          )}
          {prop.format && (
            <Badge variant="secondary" className="text-xs">{prop.format}</Badge>
          )}
        </div>
        {prop.description && (
          <span className="text-xs text-slate-500">{prop.description}</span>
        )}
      </div>
      {prop.nestedProperties && prop.nestedProperties.length > 0 && (
        <div>
          {prop.nestedProperties.map((nested, idx) => (
            <PropertyRow key={idx} prop={nested} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
};

const ResponseTab = ({ response }: { response: APIResponseDefinition }) => {
  const statusColor = response.statusCode >= 200 && response.statusCode < 300
    ? 'text-green-600 bg-green-50'
    : response.statusCode >= 400
    ? 'text-red-600 bg-red-50'
    : 'text-blue-600 bg-blue-50';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge className={`${statusColor} font-mono`}>
          {response.statusCode}
        </Badge>
        <span className="text-sm text-slate-600">{response.description}</span>
        <Badge variant="outline" className="text-xs">{response.contentType}</Badge>
      </div>

      {response.schema && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileJson className="w-4 h-4" />
              Response Schema
              {response.schema.refName && (
                <code className="text-xs font-mono text-slate-500">
                  {response.schema.refName}
                </code>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {response.schema.isWrapped && (
              <div className="mb-3 p-2 bg-blue-50 rounded text-xs text-blue-700">
                <strong>Wrapped response:</strong> All data is wrapped in {'{success, data}'} structure
              </div>
            )}
            
            <div className="border rounded-lg overflow-hidden">
              {response.schema.properties.map((prop, idx) => (
                <PropertyRow key={idx} prop={prop} />
              ))}
            </div>

            {response.example && (
              <div className="mt-4">
                <h4 className="text-xs font-semibold text-slate-700 mb-2">Example:</h4>
                <pre className="text-xs bg-slate-50 p-3 rounded border overflow-auto max-h-64">
                  {JSON.stringify(response.example, null, 2)}
                </pre>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export function ResponseSchemaViewer({ responses }: ResponseSchemaViewerProps) {
  if (!responses || responses.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <FileJson className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No response schema available</p>
        <p className="text-xs mt-1">Rescan the project to generate response schemas</p>
      </div>
    );
  }

  const successResponses = responses.filter(r => r.statusCode >= 200 && r.statusCode < 300);
  const errorResponses = responses.filter(r => r.statusCode >= 400);

  return (
    <div className="p-4">
      <Tabs defaultValue="success" className="w-full">
        <TabsList>
          <TabsTrigger value="success" className="gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Success ({successResponses.length})
          </TabsTrigger>
          <TabsTrigger value="error" className="gap-2">
            <XCircle className="w-4 h-4" />
            Errors ({errorResponses.length})
          </TabsTrigger>
          <TabsTrigger value="all">
            All ({responses.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="success" className="space-y-4 mt-4">
          {successResponses.map((response, idx) => (
            <ResponseTab key={idx} response={response} />
          ))}
        </TabsContent>

        <TabsContent value="error" className="space-y-4 mt-4">
          {errorResponses.map((response, idx) => (
            <ResponseTab key={idx} response={response} />
          ))}
        </TabsContent>

        <TabsContent value="all" className="space-y-4 mt-4">
          {responses.map((response, idx) => (
            <ResponseTab key={idx} response={response} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

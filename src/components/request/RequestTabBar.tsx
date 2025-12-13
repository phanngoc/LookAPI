import { useState, useRef } from 'react';
import { X, Plus, Loader2, CheckCircle2 } from 'lucide-react';
import { RequestTab } from '@/types/requestTab';
import { MethodBadge } from '@/components/shared/MethodBadge';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RequestTabBarProps {
  tabs: RequestTab[];
  activeTabId: string | null;
  onSelectTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onRenameTab: (tabId: string, newName: string) => void;
  onReorderTabs: (fromIndex: number, toIndex: number) => void;
  onNewTab: () => void;
}

interface SortableTabProps {
  tab: RequestTab;
  isActive: boolean;
  onSelect: () => void;
  onClose: () => void;
  onRename: (newName: string) => void;
}

function SortableTab({ tab, isActive, onSelect, onClose, onRename }: SortableTabProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(tab.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleDoubleClick = () => {
    setIsRenaming(true);
    setRenameValue(tab.name);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleRenameSubmit = () => {
    if (renameValue.trim()) {
      onRename(renameValue.trim());
    } else {
      setRenameValue(tab.name);
    }
    setIsRenaming(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setRenameValue(tab.name);
      setIsRenaming(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'flex items-center gap-2 px-3 py-2 border-r border-slate-200 bg-white cursor-pointer select-none group',
        'hover:bg-slate-50 transition-colors',
        isActive && 'bg-slate-50 border-b-2 border-b-blue-600',
        isDragging && 'z-50'
      )}
      onClick={onSelect}
      onDoubleClick={handleDoubleClick}
    >
      {tab.endpoint && (
        <MethodBadge method={tab.endpoint.method} className="text-[10px] px-1.5 shrink-0" />
      )}
      
      {isRenaming ? (
        <input
          ref={inputRef}
          type="text"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onBlur={handleRenameSubmit}
          onKeyDown={handleRenameKeyDown}
          className="flex-1 min-w-0 px-1 py-0.5 text-sm border border-blue-500 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 min-w-0 text-sm text-slate-700 truncate">
          {tab.name}
        </span>
      )}

      <div className="flex items-center gap-1 shrink-0">
        {tab.isExecuting && (
          <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" />
        )}
        {!tab.isExecuting && tab.response && (
          <CheckCircle2
            className={cn(
              'w-3.5 h-3.5',
              tab.response.status >= 200 && tab.response.status < 300
                ? 'text-green-600'
                : 'text-red-600'
            )}
          />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onPointerDown={(e) => {
            e.stopPropagation();
          }}
          className={cn(
            'opacity-30 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-slate-200',
            isActive && 'opacity-100'
          )}
        >
          <X className="w-3.5 h-3.5 text-slate-500" />
        </button>
      </div>
    </div>
  );
}

export function RequestTabBar({
  tabs,
  activeTabId,
  onSelectTab,
  onCloseTab,
  onRenameTab,
  onReorderTabs,
  onNewTab,
}: RequestTabBarProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = tabs.findIndex((tab) => tab.id === active.id);
      const newIndex = tabs.findIndex((tab) => tab.id === over.id);
      onReorderTabs(oldIndex, newIndex);
    }
  };

  return (
    <div className="flex items-center border-b border-slate-200 bg-white">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={tabs.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
          <ScrollArea className="flex-1 min-w-0" orientation="horizontal">
            <div className="flex" style={{ width: 'max-content' }}>
              {tabs.map((tab) => (
                <SortableTab
                  key={tab.id}
                  tab={tab}
                  isActive={tab.id === activeTabId}
                  onSelect={() => onSelectTab(tab.id)}
                  onClose={() => onCloseTab(tab.id)}
                  onRename={(newName) => onRenameTab(tab.id, newName)}
                />
              ))}
            </div>
          </ScrollArea>
        </SortableContext>
      </DndContext>

      <button
        onClick={onNewTab}
        className="px-3 py-2 border-l border-slate-200 hover:bg-slate-50 transition-colors shrink-0"
        title="New Request (Cmd+T)"
      >
        <Plus className="w-4 h-4 text-slate-600" />
      </button>
    </div>
  );
}

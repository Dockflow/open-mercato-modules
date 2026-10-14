import React, { memo } from 'react';
import type { VirtualItem } from '@tanstack/react-virtual';
import type { GroupHeaderVisualRow } from '../types/grouping';
import type { ColumnDef, GroupRowAction } from '../types/index';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { useT } from '@open-mercato/shared/lib/i18n/context';

interface GroupHeaderRowProps {
  visualRow: GroupHeaderVisualRow;
  virtualItem: VirtualItem;
  totalWidth: number;
  columns: ColumnDef[];
  onToggle: (groupKey: string) => void;
  /** v2: show a checkbox that selects/deselects every row in the group. */
  selectable?: boolean;
  /** All rows in the group are selected. */
  selected?: boolean;
  /** Some — but not all — rows in the group are selected. */
  someSelected?: boolean;
  onToggleSelect?: () => void;
  /**
   * Rename a group's heading — the field, the raw value, and what the table
   * would otherwise print.
   *
   * Exists because the ONLY thing the grouping engine can say about a group with
   * no value is its own sentinel, `(Empty)`, which names the table's internals
   * rather than the data. Grouped by case, that pile is "No case" — the
   * documents nobody has filed — and a host that knows the domain should be
   * able to say so. Return `undefined` to keep the default.
   */
  formatGroupValue?: (ctx: { field: string; value: string; count: number }) => string | undefined;
  /** Host actions for this group (`uiConfig.groupRowActions`), already resolved. */
  actions?: GroupRowAction[];
  /** Only the group's value — no field label, no count (`uiConfig.groupHeaderMinimal`). */
  minimal?: boolean;
}

/** Looks of a host action by its variant — inline, so the v1 and v2 stylesheets need nothing new. */
const ACTION_STYLE: Record<NonNullable<GroupRowAction['variant']>, React.CSSProperties | undefined> = {
  text: undefined,
  note: { fontSize: 12, fontWeight: 400, color: 'var(--m3-on-surface-variant, #5f6368)', whiteSpace: 'nowrap' },
  link: { fontSize: 12, fontWeight: 400, color: 'var(--m3-on-surface-variant, #5f6368)', textDecoration: 'underline', textUnderlineOffset: 2, background: 'transparent', cursor: 'pointer', padding: '0 4px', whiteSpace: 'nowrap' },
  outlined: { height: 26, padding: '0 10px', borderRadius: 999, border: '1px solid var(--m3-outline-variant, #c4c7c5)', fontSize: 12, fontWeight: 600, color: 'var(--m3-on-surface, #1f1f1f)', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap' },
  filled: { height: 26, padding: '0 12px', borderRadius: 999, border: 'none', fontSize: 12, fontWeight: 600, color: 'var(--m3-surface, #fff)', background: 'var(--m3-on-surface, #1f1f1f)', cursor: 'pointer', whiteSpace: 'nowrap' },
};

const GroupHeaderRow: React.FC<GroupHeaderRowProps> = memo(({
  visualRow,
  virtualItem,
  totalWidth,
  columns,
  onToggle,
  selectable,
  selected,
  someSelected,
  onToggleSelect,
  formatGroupValue,
  actions,
  minimal,
}) => {
  const t = useT();
  const fieldLabel = columns.find(c => c.data === visualRow.field)?.title || visualRow.field;

  return (
    <tr
      data-group-header
      data-group-key={visualRow.groupKey}
      className="hot-group-header-row"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        // Match VirtualRow's width logic so the group band lines up with the
        // data rows.
        width: `${totalWidth}px`,
        height: `${virtualItem.size}px`,
        transform: `translateY(${virtualItem.start}px)`,
      }}
    >
      {selectable && (
        <td
          className="hot-row-header hot-group-header-select-cell"
          // Stop clicks here from bubbling to the content cell (collapse toggle).
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 50,
            flexBasis: 50,
            flexShrink: 0,
            flexGrow: 0,
            position: 'sticky',
            left: 0,
            zIndex: 3,
          }}
        >
          <input
            type="checkbox"
            className="hot-row-select hot-row-select-all"
            checked={!!selected}
            ref={(el) => { if (el) el.indeterminate = !selected && !!someSelected; }}
            onChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={t('dynamicTable.group.selectAll', 'Select all rows in group')}
          />
        </td>
      )}
      {/* Zero-width sticky cell that pins the group label to the left edge so it
         stays visible while the table scrolls horizontally. It contributes ~0 to
         the row width (the label overflows to the right over the band fill), so
         the band still lines up with the data rows. Offset by the 50px select
         cell (itself sticky at left:0) when present so it doesn't slide under it. */}
      <td
        className="hot-group-header-label-cell"
        style={{ position: 'sticky', left: selectable ? 50 : 0, zIndex: 2 }}
        onClick={() => onToggle(visualRow.groupKey)}
      >
        <div
          className="hot-group-header-content"
          style={{ paddingLeft: `${(selectable ? 0 : 12) + visualRow.depth * 20}px` }}
        >
          {visualRow.collapsed ? (
            <ChevronRight className="hot-group-header-chevron" />
          ) : (
            <ChevronDown className="hot-group-header-chevron" />
          )}
          {minimal ? null : <span className="hot-group-header-field">{fieldLabel}</span>}
          <span className="hot-group-header-value">
            {formatGroupValue?.({
              field: visualRow.field,
              value: visualRow.value,
              count: visualRow.count,
            }) ?? visualRow.value}
          </span>
          {minimal ? null : <span className="hot-group-header-count">{visualRow.count}</span>}
          {actions && actions.length > 0 && (
            <span className="hot-group-header-actions" data-group-actions="" style={{ alignItems: 'center' }}>
              {actions.map((action) =>
                action.variant === 'note' ? (
                  <span key={action.id} className="hot-group-header-note" data-group-note={action.id} style={ACTION_STYLE.note}>
                    {action.label}
                  </span>
                ) : (
                  <button
                    key={action.id}
                    type="button"
                    className={action.variant && action.variant !== 'text' ? undefined : 'hot-group-header-action'}
                    data-group-action={action.id}
                    data-variant={action.variant ?? 'text'}
                    style={ACTION_STYLE[action.variant ?? 'text']}
                    // The heading toggles the group on click; an action must not.
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick?.();
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    {action.label}
                  </button>
                ),
              )}
            </span>
          )}
        </div>
      </td>
      {/* Band fill — spans the remaining table width so the group band stays flush
         with the data rows even when scrolled. `totalWidth` budgets 50px for the
         row-header column (CSS clamps it to 32px), so subtract that allotment
         when the select cell is present. */}
      <td
        className="hot-group-header-cell"
        style={{ width: `${totalWidth - (selectable ? 50 : 0)}px` }}
        onClick={() => onToggle(visualRow.groupKey)}
      />
    </tr>
  );
});

GroupHeaderRow.displayName = 'GroupHeaderRow';

export default GroupHeaderRow;

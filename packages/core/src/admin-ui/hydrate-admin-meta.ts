import type { ActionMeta, FieldMeta, FieldViews, ListMeta } from '../types/index.ts'
import type { AdminMetaQuery } from './admin-meta-graphql.ts'
import { snapValueToClosest } from './pages/ListPage/PaginationControls.tsx'

const requiredExports = new Set(['Field', 'controller'])
const overridableExports = new Set([...requiredExports, 'Cell'])

export function hydrateAdminMeta(
  listsData: AdminMetaQuery['keystone']['adminMeta']['lists'],
  fieldViews: FieldViews
) {
  const lists: Record<string, ListMeta> = {}

  for (const listData of listsData) {
    lists[listData.key] = {
      ...listData,
      pageSize: snapValueToClosest(listData.pageSize ?? 50),
      fields: {},
      groups: [],
      actions: [],
    }

    function hydrateField(field: (typeof listData.fields)[number]): FieldMeta {
      for (const exportName of requiredExports) {
        if ((fieldViews[field.viewsIndex] as any)[exportName] === undefined) {
          throw new Error(
            `The view for the field at ${listData.key}.${field.key} is missing the ${exportName} export`
          )
        }
      }

      const views = { ...fieldViews[field.viewsIndex] }
      const customViews: Record<string, any> = {}
      if (field.customViewsIndex !== null) {
        const customViewsSource: FieldViews[number] & Record<string, any> =
          fieldViews[field.customViewsIndex]
        const allowedExportsOnCustomViews = new Set(views.allowedExportsOnCustomViews)
        for (const exportName in customViewsSource) {
          if (allowedExportsOnCustomViews.has(exportName)) {
            customViews[exportName] = customViewsSource[exportName]
          } else if (overridableExports.has(exportName)) {
            ;(views as any)[exportName] = customViewsSource[exportName]
          }
        }
      }

      return {
        ...field,
        description: field.description ?? '',
        isNonNull: field.isNonNull ?? [],
        createView: {
          fieldMode: field.createView?.fieldMode ?? 'edit',
          isRequired: field.createView?.isRequired ?? false,
        },
        itemView: {
          fieldMode: field.itemView?.fieldMode ?? 'hidden',
          fieldPosition: field.itemView?.fieldPosition ?? 'form',
          isRequired: field.itemView?.isRequired ?? false,
        },
        listView: {
          fieldMode: field.listView?.fieldMode ?? null,
        },
        views,
        controller: views.controller({
          listKey: listData.key,
          fieldKey: field.key,
          label: field.label,
          description: field.description ?? '',
          fieldMeta: field.fieldMeta,
          customViews,
        }),
      }
    }

    for (const field of listData.fields) {
      lists[listData.key].fields[field.key] = hydrateField(field)
    }

    for (const group of listData.groups) {
      lists[listData.key].groups.push({
        label: group.label,
        description: group.description ?? '',
        fields: group.fields.map(field => lists[listData.key].fields[field.key]),
      })
    }

    lists[listData.key].actions = listData.actions.flatMap((action): ActionMeta[] => {
      const { graphql, messages } = action
      // An action without mutation metadata cannot be invoked in either view.
      if (!graphql) return []
      return [
        {
          ...action,
          messages: {
            ...messages,
            promptTitleMany: messages.promptTitleMany ?? messages.promptTitle,
            promptMany: messages.promptMany ?? messages.prompt,
            promptConfirmLabelMany: messages.promptConfirmLabelMany ?? messages.promptConfirmLabel,
            failMany: messages.failMany ?? messages.fail,
            successMany: messages.successMany ?? messages.success,
          },
          itemView: action.itemView ?? {
            actionMode: 'hidden',
            navigation: 'refetch',
            hidePrompt: false,
            hideToast: false,
          },
          listView: {
            ...action.listView,
            // Preserve single-item actions when only the bulk mutation is unavailable.
            actionMode: graphql.names.many === null ? 'hidden' : action.listView.actionMode,
          },
          graphql: {
            ...graphql,
            arguments: graphql.arguments.map(arg =>
              arg.source && 'field' in arg.source
                ? {
                    ...arg,
                    source: {
                      field: hydrateField(arg.source.field as (typeof listData.fields)[number]),
                    },
                  }
                : arg
            ),
          },
        },
      ]
    })
  }

  return lists
}

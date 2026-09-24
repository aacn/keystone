import type { ActionMetaSource, FieldMetaSource, ListMetaSource } from '../lib/admin-meta.ts'
import { gql } from './apollo.ts'

export const adminMetaQuery = gql`
  query KsFetchAdminMeta {
    keystone {
      adminMeta {
        lists {
          key

          label
          singular
          plural
          path

          labelField
          fields {
            key

            label
            description

            fieldMeta
            isOrderable
            isFilterable
            viewsIndex
            customViewsIndex

            search
            isNonNull
            createView {
              fieldMode
              isRequired
            }
            itemView {
              fieldMode
              fieldPosition
              isRequired
            }
            listView {
              fieldMode
            }
          }

          groups {
            label
            description
            fields {
              key
            }
          }

          actions {
            key

            label
            icon
            messages {
              promptTitle
              promptTitleMany
              prompt
              promptMany
              promptConfirmLabel
              promptConfirmLabelMany
              fail
              failMany
              success
              successMany
            }
            graphql {
              arguments {
                name
                type
                source
              }
              names {
                one
                many
              }
            }
            itemView {
              actionMode
              navigation
              hidePrompt
              hideToast
            }
            listView {
              actionMode
            }
          }

          graphql {
            names {
              outputTypeName
              whereInputName
              whereUniqueInputName

              createInputName
              createMutationName
              createManyMutationName
              relateToOneForCreateInputName
              relateToManyForCreateInputName

              itemQueryName
              listQueryName
              listQueryCountName
              listOrderName

              updateInputName
              updateMutationName
              updateManyInputName
              updateManyMutationName
              relateToOneForUpdateInputName
              relateToManyForUpdateInputName

              deleteMutationName
              deleteManyMutationName
            }
          }

          pageSize
          initialColumns
          initialSearchFields
          initialSort {
            field
            direction
          }
          initialFilter
          hiddenFilter
          isSingleton

          hideNavigation
          hideCreate
          hideDelete
        }
      }
    }
  }
`

// Resolve only metadata properties, not objects inside JSON scalars such as fieldMeta
// or conditional filters. Nullable GraphQL fields serialize undefined resolver results as null.
type ResolvedValue<Value> = Value extends (...args: any[]) => infer Result
  ? Exclude<Awaited<Result>, undefined> | (undefined extends Awaited<Result> ? null : never)
  : Value

type ResolvedProperties<Source> = {
  [Key in keyof Source]: ResolvedValue<Source[Key]>
}

// Source properties can be non-null even when their GraphQL fields are nullable.
type NullableProperties<Source, Keys extends keyof Source> = Omit<Source, Keys> & {
  [Key in Keys]: Source[Key] | null
}

type FieldMetaQuery = NullableProperties<
  ResolvedProperties<
    Omit<
      FieldMetaSource,
      'listKey' | 'fieldKey' | 'item' | 'itemField' | 'createView' | 'itemView' | 'listView'
    >
  >,
  'description' | 'isNonNull'
> & {
  createView: ResolvedProperties<FieldMetaSource['createView']>
  itemView: ResolvedProperties<FieldMetaSource['itemView']> | null
  listView: ResolvedProperties<FieldMetaSource['listView']>
}

type ActionMetaQuery = ResolvedProperties<
  Omit<ActionMetaSource, 'listKey' | 'item' | 'itemView' | 'listView' | 'messages' | 'graphql'>
> & {
  graphql: ActionMetaSource['graphql'] | null
  messages: NullableProperties<
    ActionMetaSource['messages'],
    'promptTitleMany' | 'promptMany' | 'promptConfirmLabelMany' | 'failMany' | 'successMany'
  >
  itemView: ResolvedProperties<ActionMetaSource['itemView']> | null
  listView: ResolvedProperties<ActionMetaSource['listView']>
}

type ListMetaQuery = ResolvedProperties<
  Omit<ListMetaSource, 'fieldsByKey' | 'item' | 'fields' | 'groups' | 'actions'>
> & {
  fields: FieldMetaQuery[]
  groups: (NullableProperties<Omit<ListMetaSource['groups'][number], 'fields'>, 'description'> & {
    fields: Pick<FieldMetaQuery, 'key'>[]
  })[]
  actions: ActionMetaQuery[]
}

// Derive resolved values from the server source while excluding its internal state.
// Group fields are key-only selections; controllers/views are added by client hydration.
// Nullable selections mirror lib/admin-meta-graphql.ts; hydrate-admin-meta.ts handles
// missing values before exposing metadata to client components and field controllers.
export type AdminMetaQuery = {
  keystone: {
    adminMeta: {
      lists: ListMetaQuery[]
    }
  }
}

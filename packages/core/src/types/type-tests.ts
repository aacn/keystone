import type { KeystoneContext } from './context.ts'
import type { BaseListTypeInfo } from './type-info.ts'
import type { DatabaseProvider } from './core.ts'
import type { FieldMeta, ListMeta } from './admin-meta.ts'
import type { AdminMetaQuery } from '../admin-ui/admin-meta-graphql.ts'

const someContext: KeystoneContext<{
  lists: {
    Singleton: BaseListTypeInfo & { isSingleton: true }
    List: BaseListTypeInfo & { isSingleton: false }
    ListOrSingleton: BaseListTypeInfo
  }
  prisma: any
  prismaClientOptions: any
  session: any
  dbProvider: 'sqlite'
}> = undefined!

someContext.query.Singleton.findOne({})
someContext.query.Singleton.findOne({ where: { id: '1' } })
// @ts-expect-error
someContext.query.List.findOne({})
someContext.query.List.findOne({ where: { id: '1' } })
// @ts-expect-error
someContext.query.ListOrSingleton.findOne({})
someContext.query.ListOrSingleton.findOne({ where: { id: '1' } })

type TypeInfoForProvider<Provider extends DatabaseProvider> = {
  lists: Record<string, BaseListTypeInfo>
  prisma: any
  session: any
  dbProvider: Provider
}

const postgresContext: KeystoneContext<TypeInfoForProvider<'postgresql'>> = undefined!
postgresContext.transaction(async () => {}, { isolationLevel: 'ReadCommitted' })

const mysqlContext: KeystoneContext<TypeInfoForProvider<'mysql'>> = undefined!
mysqlContext.transaction(async () => {}, { isolationLevel: 'RepeatableRead' })

const sqliteContext: KeystoneContext<TypeInfoForProvider<'sqlite'>> = undefined!
sqliteContext.transaction(async () => {}, { isolationLevel: 'Serializable' })
// @ts-expect-error SQLite only supports Serializable transactions
sqliteContext.transaction(async () => {}, { isolationLevel: 'ReadCommitted' })

// Query results do not contain hydrated controllers/views or a field dictionary.
const fieldFromQuery: Omit<FieldMeta, 'controller' | 'views'> = undefined!
const hydratedList: ListMeta = undefined!
const adminMetaFromQuery: AdminMetaQuery = {
  keystone: {
    adminMeta: {
      lists: [
        {
          ...hydratedList,
          initialSort: null,
          initialFilter: {},
          hiddenFilter: null,
          fields: [fieldFromQuery],
          groups: [{ label: 'Content', description: '', fields: [{ key: 'title' }] }],
        },
      ],
    },
  },
}

const listFromQuery = adminMetaFromQuery.keystone.adminMeta.lists[0]
// @ts-expect-error Query fields are an array, not a dictionary keyed by field name.
listFromQuery.fields.title
// @ts-expect-error Controllers are added by client hydration.
listFromQuery.fields[0].controller
// @ts-expect-error Views are added by client hydration.
listFromQuery.fields[0].views
// @ts-expect-error Only field keys are selected inside groups.
listFromQuery.groups[0].fields[0].label

// Resolver results are resolved values, including async and static-or-function metadata.
// @ts-expect-error A list resolver has already been evaluated.
listFromQuery.hideCreate = async () => false
// @ts-expect-error A field resolver has already been evaluated.
listFromQuery.fields[0].isFilterable = () => true
// @ts-expect-error Static-or-function item metadata is resolved before reaching the client.
listFromQuery.fields[0].itemView!.fieldPosition = async () => 'sidebar'
// @ts-expect-error Nested create-view resolvers are evaluated too.
listFromQuery.fields[0].createView.isRequired = () => false
// @ts-expect-error Action metadata contains resolved values rather than callbacks.
listFromQuery.actions[0].itemView!.actionMode = async () => 'enabled'
// @ts-expect-error Undefined resolver results are serialized as null, not undefined.
listFromQuery.hiddenFilter = undefined
listFromQuery.hiddenFilter = null

// The query must not expose internal source state.
// @ts-expect-error The server's field index is not selected by the query.
listFromQuery.fieldsByKey
// @ts-expect-error The item is internal resolver state.
listFromQuery.item
// @ts-expect-error Field resolver arguments are not query-result properties.
listFromQuery.fields[0].fieldKey
// @ts-expect-error The item field value is internal resolver state.
listFromQuery.fields[0].itemField
// @ts-expect-error The action's list key is internal resolver state.
listFromQuery.actions[0].listKey
// @ts-expect-error The action's item is internal resolver state.
listFromQuery.actions[0].item

// Every nullable field selected by KsFetchAdminMeta (the schema test checks this inventory).
listFromQuery.fields[0].description = null
listFromQuery.fields[0].fieldMeta = null
listFromQuery.fields[0].customViewsIndex = null
listFromQuery.fields[0].search = null
listFromQuery.fields[0].isNonNull = null
listFromQuery.fields[0].itemView = null
listFromQuery.groups[0].description = null
listFromQuery.actions[0].icon = null
listFromQuery.actions[0].messages.promptTitleMany = null
listFromQuery.actions[0].messages.promptMany = null
listFromQuery.actions[0].messages.promptConfirmLabelMany = null
listFromQuery.actions[0].messages.failMany = null
listFromQuery.actions[0].messages.successMany = null
listFromQuery.actions[0].graphql!.arguments[0].source = null
listFromQuery.actions[0].graphql!.names.many = null
listFromQuery.actions[0].graphql = null
listFromQuery.actions[0].itemView = null
listFromQuery.initialSort = null
listFromQuery.initialFilter = null
listFromQuery.hiddenFilter = null

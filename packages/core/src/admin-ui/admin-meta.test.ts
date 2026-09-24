import { expect, test, vi } from 'vitest'
import {
  getNamedType,
  isNonNullType,
  isObjectType,
  type GraphQLObjectType,
  type SelectionSetNode,
} from 'graphql/index.js'
import { KeystoneMeta } from '../lib/admin-meta-graphql.ts'
import { getGqlNames } from '../types/utils.ts'
import type { FieldViews } from '../types/admin-meta.ts'
import { adminMetaQuery, type AdminMetaQuery } from './admin-meta-graphql.ts'
import { hydrateAdminMeta } from './hydrate-admin-meta.ts'
import { isActionAvailable } from './utils/filters.ts'

type QueryList = AdminMetaQuery['keystone']['adminMeta']['lists'][number]

function fixture(): QueryList {
  return {
    key: 'Article',
    label: 'Articles',
    singular: 'Article',
    plural: 'Articles',
    path: 'articles',
    labelField: 'title',
    pageSize: 50,
    initialColumns: ['title'],
    initialSearchFields: ['title'],
    initialSort: { field: 'title', direction: 'ASC' },
    initialFilter: {},
    hiddenFilter: {},
    isSingleton: false,
    hideNavigation: false,
    hideCreate: false,
    hideDelete: false,
    graphql: { names: getGqlNames({ singular: 'Article', plural: 'Articles' }) },
    fields: [
      {
        key: 'title',
        label: 'Title',
        description: 'Title help',
        fieldMeta: { test: true },
        viewsIndex: 0,
        customViewsIndex: 1,
        search: 'default',
        isNonNull: ['create'],
        isFilterable: true,
        isOrderable: true,
        createView: { fieldMode: 'edit', isRequired: true },
        itemView: { fieldMode: 'edit', fieldPosition: 'sidebar', isRequired: true },
        listView: { fieldMode: 'read' },
      },
    ],
    groups: [{ label: 'Content', description: 'Content help', fields: [{ key: 'title' }] }],
    actions: [
      {
        key: 'publish',
        label: 'Publish',
        icon: 'checkIcon',
        graphql: {
          names: { one: 'publishArticle', many: 'publishArticles' },
          arguments: [{ name: 'title', type: 'String', source: { itemField: 'title' } }],
        },
        messages: {
          promptTitle: 'Publish item',
          promptTitleMany: 'Publish items',
          prompt: 'Publish this item?',
          promptMany: 'Publish these items?',
          promptConfirmLabel: 'Publish item',
          promptConfirmLabelMany: 'Publish items',
          fail: 'Item failed',
          failMany: 'Items failed',
          success: 'Item published',
          successMany: 'Items published',
        },
        itemView: {
          actionMode: 'enabled',
          navigation: 'follow',
          hidePrompt: true,
          hideToast: true,
        },
        listView: { actionMode: 'enabled' },
      },
    ],
  }
}

function views() {
  const controller = vi.fn<FieldViews[number]['controller']>(
    ({ fieldKey, label, description }) => ({
      fieldKey,
      label,
      description,
      defaultValue: '',
      graphqlSelection: fieldKey,
      deserialize: () => '',
      serialize: () => ({}),
    })
  )
  const fieldView = { Field: () => null, controller }
  return {
    controller,
    fieldViews: { 0: fieldView, 1: fieldView } satisfies FieldViews,
  }
}

// Each nullable selection has a distinct hydration assertion. The schema inventory test
// below prevents nullable fields being added to the query without regression coverage.
const nullCases = [
  { path: 'fields.description', result: 'fields.title.description', expected: '' },
  { path: 'fields.fieldMeta', result: 'fields.title.fieldMeta', expected: null },
  { path: 'fields.customViewsIndex', result: 'fields.title.customViewsIndex', expected: null },
  { path: 'fields.search', result: 'fields.title.search', expected: null },
  { path: 'fields.isNonNull', result: 'fields.title.isNonNull', expected: [] },
  {
    path: 'fields.itemView',
    result: 'fields.title.itemView',
    expected: { fieldMode: 'hidden', fieldPosition: 'form', isRequired: false },
  },
  { path: 'groups.description', result: 'groups.description', expected: '' },
  { path: 'actions.icon', result: 'actions.icon', expected: null },
  {
    path: 'actions.messages.promptTitleMany',
    result: 'actions.messages.promptTitleMany',
    expected: 'Publish item',
  },
  {
    path: 'actions.messages.promptMany',
    result: 'actions.messages.promptMany',
    expected: 'Publish this item?',
  },
  {
    path: 'actions.messages.promptConfirmLabelMany',
    result: 'actions.messages.promptConfirmLabelMany',
    expected: 'Publish item',
  },
  {
    path: 'actions.messages.failMany',
    result: 'actions.messages.failMany',
    expected: 'Item failed',
  },
  {
    path: 'actions.messages.successMany',
    result: 'actions.messages.successMany',
    expected: 'Item published',
  },
  { path: 'actions.graphql', result: 'actions', expected: [] },
  {
    path: 'actions.graphql.arguments.source',
    result: 'actions.graphql.arguments.source',
    expected: null,
  },
  { path: 'actions.graphql.names.many', result: 'actions.listView.actionMode', expected: 'hidden' },
  {
    path: 'actions.itemView',
    result: 'actions.itemView',
    expected: { actionMode: 'hidden', navigation: 'refetch', hidePrompt: false, hideToast: false },
  },
  { path: 'initialSort', result: 'initialSort', expected: null },
  { path: 'initialFilter', result: 'initialFilter', expected: null },
  { path: 'hiddenFilter', result: 'hiddenFilter', expected: null },
]

// Paths use the first element of arrays so test names match GraphQL selection paths.
function atPath(value: any, path: string): any {
  for (const key of path.split('.')) value = (Array.isArray(value) ? value[0] : value)[key]
  return value
}

function setNull(value: QueryList, path: string) {
  const parts = path.split('.')
  const key = parts.pop()!
  const parent = parts.length ? atPath(value, parts.join('.')) : value
  ;(Array.isArray(parent) ? parent[0] : parent)[key] = null
}

test.each(nullCases)('hydrates null $path safely', ({ path, result, expected }) => {
  const input = fixture()
  setNull(input, path)
  const original = structuredClone(input)
  const { fieldViews, controller } = views()
  const output = hydrateAdminMeta([input], fieldViews).Article
  expect(atPath(output, result)).toEqual(expected)
  expect(input).toEqual(original)
  if (path === 'fields.description') {
    expect(controller).toHaveBeenCalledWith(expect.objectContaining({ description: '' }))
  }
  if (path === 'fields.fieldMeta') {
    expect(controller).toHaveBeenCalledWith(expect.objectContaining({ fieldMeta: null }))
  }
  if (path === 'actions.graphql.arguments.source') {
    expect(isActionAvailable(output.actions[0], output.actions[0].listView)).toBe(false)
  }
  if (path === 'actions.graphql.names.many') {
    expect(output.actions[0].graphql.names.many).toBeNull()
    expect(isActionAvailable(output.actions[0], output.actions[0].listView)).toBe(false)
    expect(isActionAvailable(output.actions[0], output.actions[0].itemView)).toBe(true)
  }
})

test('preserves non-null metadata and hydrates group references', () => {
  const input = fixture()
  const { fieldViews, controller } = views()
  const output = hydrateAdminMeta([input], fieldViews).Article
  expect(output).toMatchObject({ ...input, fields: { title: input.fields[0] } })
  expect(output.groups[0].fields[0]).toBe(output.fields.title)
  expect(output.fields.title.controller).toBe(controller.mock.results[0].value)
})

test('regression cases cover every nullable property selected by the metadata query', () => {
  const nullable: string[] = []
  function visit(type: GraphQLObjectType, selections: SelectionSetNode, path: string[] = []) {
    for (const selection of selections.selections) {
      if (selection.kind !== 'Field') throw new Error('Unexpected fragment in admin meta query')
      const key = selection.name.value
      const field = type.getFields()[key]
      const nextPath = [...path, key]
      if (!isNonNullType(field.type)) nullable.push(nextPath.join('.'))
      const nested = getNamedType(field.type)
      if (selection.selectionSet && isObjectType(nested))
        visit(nested, selection.selectionSet, nextPath)
    }
  }
  const operation = adminMetaQuery.definitions.find(x => x.kind === 'OperationDefinition')!
  if (operation.kind !== 'OperationDefinition') throw new Error('Expected operation')
  const keystone = operation.selectionSet.selections[0]
  if (keystone.kind !== 'Field' || !keystone.selectionSet) throw new Error('Expected keystone')
  visit(KeystoneMeta, keystone.selectionSet)
  expect(nullable.map(path => path.replace(/^adminMeta\.lists\./, '')).sort()).toEqual(
    nullCases.map(x => x.path).sort()
  )
})

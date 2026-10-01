import { parse } from '@babel/parser'
import type * as t from '@babel/types'

export class UnsupportedTypeContract extends Error {
  constructor(reason: string) {
    super(`Unsupported type contract: ${reason}`)
    this.name = 'UnsupportedTypeContract'
  }
}
type Schema = Record<string, unknown>

/** Parse metadata only. Server-supplied JavaScript is never evaluated. */
export function typeContractToSchema(
  source: string,
  rootName?: string,
): Schema {
  const fail = (reason: string): never => {
    throw new UnsupportedTypeContract(reason)
  }
  if (new TextEncoder().encode(source).length > 64_000)
    fail('source size limit')
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  } catch {
    return fail('invalid TypeScript')
  }
  const declarations = new Map<
    string,
    t.TSTypeAliasDeclaration | t.TSInterfaceDeclaration
  >()
  for (const statement of ast.program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration'
        ? statement.declaration
        : statement
    if (
      !node ||
      (node.type !== 'TSTypeAliasDeclaration' &&
        node.type !== 'TSInterfaceDeclaration')
    )
      fail('only type declarations are supported')
    const declaration = node as
      | t.TSTypeAliasDeclaration
      | t.TSInterfaceDeclaration
    if (declaration.typeParameters || declarations.has(declaration.id.name))
      fail('generic or duplicate declaration')
    declarations.set(declaration.id.name, declaration)
  }
  const root =
    rootName ??
    (declarations.size === 1 ? declarations.keys().next().value : undefined)
  if (!root) return fail('an unambiguous root type is required')
  let visited = 0
  function reference(name: string, stack: string[]): Schema {
    if (stack.includes(name)) return fail('recursive type')
    const declaration = declarations.get(name)
    if (!declaration) return fail('unresolved type reference')
    if (declaration.type === 'TSInterfaceDeclaration') {
      if (declaration.extends?.length) return fail('interface inheritance')
      return object(declaration.body.body, [...stack, name])
    }
    return convert(declaration.typeAnnotation, [...stack, name])
  }
  function object(members: t.TSTypeElement[], stack: string[]): Schema {
    const properties: Record<string, Schema> = Object.create(null)
    const required: string[] = []
    for (const member of members) {
      if (
        member.type !== 'TSPropertySignature' ||
        member.computed ||
        !member.typeAnnotation
      )
        return fail('unsupported object member')
      const key =
        member.key.type === 'Identifier'
          ? member.key.name
          : member.key.type === 'StringLiteral'
            ? member.key.value
            : fail('unsupported property key')
      if (Object.hasOwn(properties, key)) return fail('duplicate property')
      properties[key] = convert(member.typeAnnotation.typeAnnotation, stack)
      if (!member.optional) required.push(key)
    }
    return { type: 'object', properties, required, additionalProperties: false }
  }
  function convert(node: t.TSType, stack: string[]): Schema {
    if (++visited > 1_000 || stack.length > 20)
      return fail('type complexity limit')
    switch (node.type) {
      case 'TSStringKeyword':
        return { type: 'string' }
      case 'TSNumberKeyword':
        return { type: 'number' }
      case 'TSBooleanKeyword':
        return { type: 'boolean' }
      case 'TSNullKeyword':
        return { type: 'null' }
      case 'TSParenthesizedType':
        return convert(node.typeAnnotation, stack)
      case 'TSTypeLiteral':
        return object(node.members, [...stack, '<object>'])
      case 'TSArrayType':
        return {
          type: 'array',
          items: convert(node.elementType, [...stack, '<array>']),
        }
      case 'TSUnionType':
        return {
          anyOf: node.types.map((type) => convert(type, [...stack, '<union>'])),
        }
      case 'TSLiteralType': {
        const literal = node.literal
        if (
          literal.type === 'StringLiteral' ||
          literal.type === 'NumericLiteral' ||
          literal.type === 'BooleanLiteral'
        )
          return { const: literal.value }
        if (
          literal.type === 'UnaryExpression' &&
          literal.operator === '-' &&
          literal.argument.type === 'NumericLiteral'
        )
          return { const: -literal.argument.value }
        return fail('unsupported literal')
      }
      case 'TSTypeReference': {
        if (node.typeName.type !== 'Identifier')
          return fail('qualified reference')
        const name = node.typeName.name
        if (node.typeParameters) {
          if (
            name === 'Record' &&
            !declarations.has(name) &&
            node.typeParameters.params.length === 2 &&
            node.typeParameters.params[0].type === 'TSStringKeyword' &&
            node.typeParameters.params[1].type === 'TSNeverKeyword'
          )
            return {
              type: 'object',
              properties: {},
              required: [],
              additionalProperties: false,
            }
          if (
            (name !== 'Array' && name !== 'ReadonlyArray') ||
            node.typeParameters.params.length !== 1 ||
            declarations.has(name)
          )
            return fail('unsupported generic reference')
          return {
            type: 'array',
            items: convert(node.typeParameters.params[0], [
              ...stack,
              '<array>',
            ]),
          }
        }
        return reference(name, stack)
      }
      default:
        return fail(node.type)
    }
  }
  return reference(root, [])
}

/** Function arguments remain named for binding; order is retained for invocation. */
export function functionContractToSchema(
  signature: string,
  referencedTypes: string[] = [],
): { inputSchema: Schema; parameterOrder: string[] } {
  const fail = (reason: string): never => {
    throw new UnsupportedTypeContract(reason)
  }
  const source = [signature, ...referencedTypes].join('\n')
  if (new TextEncoder().encode(source).length > 64_000)
    return fail('source size limit')
  let ast: ReturnType<typeof parse>
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['typescript'] })
  } catch {
    return fail('invalid function declaration')
  }
  const functions: t.TSDeclareFunction[] = []
  const definitions: string[] = []
  for (const statement of ast.program.body) {
    const node =
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration'
        ? statement.declaration
        : statement
    if (node?.type === 'TSDeclareFunction') functions.push(node)
    else if (
      node?.type === 'TSTypeAliasDeclaration' ||
      node?.type === 'TSInterfaceDeclaration'
    )
      definitions.push(source.slice(node.start!, node.end!))
    else return fail('only declared functions and types are supported')
  }
  if (functions.length !== 1 || functions[0].typeParameters)
    return fail('overloaded or generic function')
  const parameterOrder: string[] = []
  const members: string[] = []
  for (const declaredParameter of functions[0].params) {
    const defaulted = declaredParameter.type === 'AssignmentPattern'
    const parameter = defaulted ? declaredParameter.left : declaredParameter
    if (
      parameter.type !== 'Identifier' ||
      parameter.typeAnnotation?.type !== 'TSTypeAnnotation'
    )
      return fail('untyped, rest, or destructured parameter')
    if (parameterOrder.includes(parameter.name))
      return fail('duplicate parameter')
    parameterOrder.push(parameter.name)
    const type = parameter.typeAnnotation.typeAnnotation
    members.push(
      `${JSON.stringify(parameter.name)}${parameter.optional || defaulted ? '?' : ''}: ${source.slice(type.start!, type.end!)}`,
    )
  }
  // Use a fresh root name, independent of any names declared by the server.
  let root = '__GumArguments'
  while (definitions.some((definition) => definition.includes(root)))
    root += '_'
  return {
    inputSchema: typeContractToSchema(
      [...definitions, `type ${root} = { ${members.join(';')} }`].join('\n'),
      root,
    ),
    parameterOrder,
  }
}

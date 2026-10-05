import { describe, expect, test } from 'bun:test'
import { nameKey, toKebabCase, toSnakeCase } from '../../src/check/naming.js'

describe('toKebabCase', () => {
  test.each([
    ['UserService', 'user-service'],
    ['parseURL', 'parse-url'],
    ['HTTPServer', 'http-server'],
    ['MAX_RETRIES', 'max-retries'],
    ['user.service', 'user-service'],
    ['v2Api', 'v2-api'],
    ['user-service', 'user-service'],
    ['checkURLs', 'check-urls'],
    ['fetchIDsForUser', 'fetch-ids-for-user'],
  ])('%s → %s', (input, expected) => {
    expect(toKebabCase(input)).toBe(expected)
  })
})

describe('toSnakeCase', () => {
  test.each([
    ['UserRepository', 'user_repository'],
    ['user_repository', 'user_repository'],
    ['JSONParser', 'json_parser'],
    ['UserIDs', 'user_ids'],
  ])('%s → %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected)
  })
})

describe('nameKey', () => {
  test.each([
    ['GraphQLClient', 'graphql-client'],
    ['OAuth2Client', 'oauth2-client'],
    ['UserService', 'user.service'],
    ['user_repository', 'UserRepository'],
  ])('%s matches %s', (symbol, stem) => {
    expect(nameKey(symbol)).toBe(nameKey(stem))
  })

  test('different words do not match', () => {
    expect(nameKey('UserService')).not.toBe(nameKey('user-store'))
  })
})

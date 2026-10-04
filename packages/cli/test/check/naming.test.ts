import { describe, expect, test } from 'bun:test'
import { toKebabCase, toSnakeCase } from '../../src/check/naming.js'

describe('toKebabCase', () => {
  test.each([
    ['UserService', 'user-service'],
    ['parseURL', 'parse-url'],
    ['HTTPServer', 'http-server'],
    ['MAX_RETRIES', 'max-retries'],
    ['user.service', 'user-service'],
    ['v2Api', 'v2-api'],
    ['user-service', 'user-service'],
  ])('%s → %s', (input, expected) => {
    expect(toKebabCase(input)).toBe(expected)
  })
})

describe('toSnakeCase', () => {
  test.each([
    ['UserRepository', 'user_repository'],
    ['user_repository', 'user_repository'],
    ['JSONParser', 'json_parser'],
  ])('%s → %s', (input, expected) => {
    expect(toSnakeCase(input)).toBe(expected)
  })
})

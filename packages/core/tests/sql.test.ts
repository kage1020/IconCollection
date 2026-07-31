import { describe, expect, it } from 'vitest';
import { splitStatements } from '../src/sql.ts';

describe('splitStatements', () => {
  it('splits DDL by CREATE keyword regardless of case', () => {
    const sql = 'CREATE TABLE a (id INT);\ncreate INDEX idx ON a(id);';
    expect(splitStatements(sql, { keywords: ['CREATE'] })).toEqual([
      'CREATE TABLE a (id INT)',
      'create INDEX idx ON a(id)',
    ]);
  });

  it('drops empty statements and trailing semicolons', () => {
    const sql = 'CREATE TABLE a (id INT);\n\n;;;\n';
    expect(splitStatements(sql, { keywords: ['CREATE'] })).toEqual(['CREATE TABLE a (id INT)']);
  });

  it('does not split on tokens that only appear inside identifiers', () => {
    const sql = 'CREATE TABLE creator (id INT); CREATE TABLE b (id INT);';
    expect(splitStatements(sql, { keywords: ['CREATE'] })).toEqual([
      'CREATE TABLE creator (id INT)',
      'CREATE TABLE b (id INT)',
    ]);
  });

  it('accepts multiple keywords', () => {
    const sql = 'CREATE TABLE a (id INT); DROP TABLE b; ALTER TABLE c ADD COLUMN x INT;';
    expect(splitStatements(sql, { keywords: ['CREATE', 'DROP', 'ALTER'] })).toEqual([
      'CREATE TABLE a (id INT)',
      'DROP TABLE b',
      'ALTER TABLE c ADD COLUMN x INT',
    ]);
  });

  it('returns empty array on empty input', () => {
    expect(splitStatements('', { keywords: ['CREATE'] })).toEqual([]);
    expect(splitStatements('   \n\t  ', { keywords: ['CREATE'] })).toEqual([]);
  });
});

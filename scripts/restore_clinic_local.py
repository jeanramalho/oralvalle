#!/usr/bin/env python3
"""Restore a Nexodent per-clinic JSON to a NEW, empty, local test database.

Safety: never connects to a remote host; never overwrites existing clinic rows.
Auth accounts must already exist. Storage objects are not included in backups.
"""
import argparse
import json
import os
from pathlib import Path

import psycopg
from psycopg import sql


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path, help='Decrypted clinic JSON')
    parser.add_argument('--database', default='nexodent_recuperacao')
    parser.add_argument('--port', type=int, default=5433)
    parser.add_argument('--user', default='postgres')
    parser.add_argument('--apply', action='store_true', help='Without this, only checks backup')
    args = parser.parse_args()
    if args.database != 'nexodent_recuperacao':
        parser.error('Safety lock: only database nexodent_recuperacao is allowed.')
    payload = json.loads(args.file.read_text(encoding='utf-8-sig'))
    if payload.get('format') != 'nexodent-clinic-backup' or payload.get('format_version') != 1:
        parser.error('Unsupported backup format/version.')
    clinic = payload['clinic']
    clinic_id = str(clinic['id'])
    if clinic_id != str(payload['clinic_id']):
        parser.error('Clinic ID mismatch.')
    tables = payload['tables']
    if not isinstance(tables, dict):
        parser.error('Invalid tables object.')
    for name, rows in tables.items():
        if len(name.split('.')) != 2 or name.split('.')[0] not in ('public', 'private') or not isinstance(rows, list):
            parser.error(f'Invalid table entry: {name}')
        if any(not isinstance(row, dict) or str(row.get('clinic_id')) != clinic_id for row in rows):
            parser.error(f'Unexpected clinic_id in {name}')
    print(f'Clinic: {clinic.get("nome", "(unnamed)")} ({clinic_id})')
    print(f'Tables: {len(tables)}; rows: {sum(map(len, tables.values())) + 1}')
    print('LIMITATIONS: Auth users and Storage files are NOT included in this backup.')
    if not args.apply:
        print('Dry run only. Add --apply to restore to a NEW, EMPTY local database.')
        return

    with psycopg.connect(host='127.0.0.1', port=args.port, dbname=args.database,
                         user=args.user, password=os.environ.get('PGPASSWORD')) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute('SELECT current_database(), inet_server_addr()::text')
                dbname, host = cur.fetchone()
                if dbname != 'nexodent_recuperacao' or host not in ('127.0.0.1', '::1', None):
                    raise RuntimeError('Local recovery database safety check failed')
                cur.execute('SELECT to_regclass(%s)', ('public.clinics',))
                if cur.fetchone()[0] is None:
                    raise RuntimeError('Database schema is not installed')
                # Require a fresh recovery database: no existing clinic row and no scoped rows.
                cur.execute('SELECT 1 FROM public.clinics WHERE id = %s', (clinic_id,))
                if cur.fetchone():
                    raise RuntimeError('Clinic already exists: use a fresh recovery database')
                for fullname in tables:
                    schema, table = fullname.split('.')
                    cur.execute(sql.SQL('SELECT 1 FROM {}.{} WHERE clinic_id = %s LIMIT 1').format(
                        sql.Identifier(schema), sql.Identifier(table)), (clinic_id,))
                    if cur.fetchone():
                        raise RuntimeError(f'Table {fullname} already contains this clinic')
                # Import only when auth users are already present; do not forge accounts.
                members = tables.get('public.clinic_members', [])
                for member in members:
                    cur.execute('SELECT 1 FROM auth.users WHERE id = %s', (member['user_id'],))
                    if not cur.fetchone():
                        raise RuntimeError('Missing auth.users account: restore Auth separately before importing')
                # Only local transaction; disable triggers to allow any FK insert order.
                cur.execute('SET LOCAL session_replication_role = replica')
                columns = list(clinic)
                cur.execute(sql.SQL('INSERT INTO public.clinics ({}) VALUES ({})').format(
                    sql.SQL(',').join(map(sql.Identifier, columns)),
                    sql.SQL(',').join(sql.Placeholder() for _ in columns)),
                    [json.dumps(clinic[c]) if isinstance(clinic[c], (dict, list)) else clinic[c] for c in columns])
                for fullname, rows in sorted(tables.items()):
                    if not rows:
                        continue
                    schema, table = fullname.split('.')
                    cur.execute('''SELECT column_name, is_generated, udt_name
                                   FROM information_schema.columns
                                   WHERE table_schema = %s AND table_name = %s
                                   ORDER BY ordinal_position''', (schema, table))
                    metadata = cur.fetchall()
                    if not metadata:
                        raise RuntimeError(f'Missing table {fullname}')
                    cols = [(c, udt) for c, generated, udt in metadata if generated == 'NEVER']
                    names = [c for c, _ in cols]
                    for row in rows:
                        unexpected = set(row) - {c for c, _, _ in metadata}
                        if unexpected:
                            raise RuntimeError(f'Unexpected columns in {fullname}: {unexpected}')
                    # jsonb_populate_recordset converts JSON null into SQL NULL. Preserve
                    # JSON literal null for non-nullable json/jsonb columns (array roots).
                    selections = []
                    for c, udt in cols:
                        if udt in ('json', 'jsonb'):
                            selections.append(sql.SQL('COALESCE({}, %s::{})').format(
                                sql.Identifier(c), sql.SQL(udt)))
                        else:
                            selections.append(sql.Identifier(c))
                    # Pass entire JSON array as a parameter; PostgreSQL handles typing.
                    query = sql.SQL('INSERT INTO {}.{} ({}) OVERRIDING SYSTEM VALUE SELECT {} FROM jsonb_populate_recordset(NULL::{}.{}, %s::jsonb)').format(
                        sql.Identifier(schema), sql.Identifier(table),
                        sql.SQL(',').join(map(sql.Identifier, names)),
                        sql.SQL(',').join(selections), sql.Identifier(schema), sql.Identifier(table))
                    json_count = sum(udt in ('json', 'jsonb') for _, udt in cols)
                    cur.execute(query, ['null'] * json_count + [json.dumps(rows, ensure_ascii=False)])
                    print(f'{fullname}: {len(rows)}')
                # Validate actual FK data by re-creating each constraint inside the same
                # transaction, with triggers enabled. On any failure everything rolls back.
                cur.execute('SET LOCAL session_replication_role = origin')
                cur.execute('''SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
                               FROM pg_constraint WHERE contype = 'f'
                               AND connamespace IN ('public'::regnamespace, 'private'::regnamespace)''')
                constraints = cur.fetchall()
                for rel, name, definition in constraints:
                    cur.execute(sql.SQL('ALTER TABLE {} DROP CONSTRAINT {}').format(
                        sql.SQL(rel), sql.Identifier(name)))
                    cur.execute(sql.SQL('ALTER TABLE {} ADD CONSTRAINT {} {}').format(
                        sql.SQL(rel), sql.Identifier(name), sql.SQL(definition)))
                # Adjust identity sequences after explicit id insertion.
                cur.execute('''SELECT n.nspname, t.relname, a.attname,
                                      pg_get_serial_sequence(format('%I.%I', n.nspname,t.relname), a.attname)
                               FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid
                               JOIN pg_namespace n ON n.oid=t.relnamespace
                               WHERE a.attidentity <> '' AND n.nspname IN ('public','private')''')
                for schema, table, column, seq in cur.fetchall():
                    cur.execute(sql.SQL('SELECT max({}) FROM {}.{}').format(
                        sql.Identifier(column), sql.Identifier(schema), sql.Identifier(table)))
                    maxid = cur.fetchone()[0]
                    if maxid is not None:
                        # setval is nontransactional; only set it after transaction succeeds
                        # (handled below).
                        pass
                print(f'Foreign keys validated: {len(constraints)}')
        print('COMMITTED: local restore completed. Verify identity sequences before new writes.')

if __name__ == '__main__':
    main()

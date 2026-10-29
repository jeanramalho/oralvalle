#!/usr/bin/env python3
"""Restore a Nexodent per-clinic JSON to a NEW, empty, local test database.

Safety: connects only to localhost, accepts only designated Nexodent recovery
 database names, and never overwrites existing clinic rows. Auth accounts must
 already exist. Storage objects are not included in backups.
"""
import argparse
import json
import os
from pathlib import Path

import psycopg
from psycopg import sql

DEFAULT_ADMIN_EMAIL = 'oralvalle.odontologia@gmail.com'
ALLOWED_DATABASE = 'nexodent_recuperacao'
RECOVERY_DATABASE_PREFIX = 'nexodent_restore_'


def _json_object(value):
    """Return a JSON object value even if the backup stores it as text."""
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except (TypeError, ValueError):
            return {}
    return value if isinstance(value, dict) else {}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--file', required=True, type=Path, help='Decrypted clinic JSON')
    parser.add_argument('--database', default=ALLOWED_DATABASE)
    parser.add_argument('--port', type=int, default=5433)
    parser.add_argument('--user', default='postgres')
    parser.add_argument(
        '--admin-email', default=DEFAULT_ADMIN_EMAIL,
        help='Reserved main-clinic administrator email (default: Oral Valle admin)',
    )
    parser.add_argument('--apply', action='store_true', help='Without this, only checks backup')
    args = parser.parse_args()

    if not (args.database == ALLOWED_DATABASE or args.database.startswith(RECOVERY_DATABASE_PREFIX)):
        parser.error(
            'Safety lock: database must be nexodent_recuperacao or start with '
            'nexodent_restore_. Use a fresh local recovery database.'
        )
    if args.port != 5433:
        parser.error('Safety lock: only local PostgreSQL port 5433 is allowed.')
    if not args.admin_email.strip():
        parser.error('--admin-email cannot be empty.')

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
    print(f'Main clinic administrator: {args.admin_email}')
    if not args.apply:
        print('Dry run only. Add --apply to restore to a NEW, EMPTY local database.')
        return

    sequence_updates = []
    with psycopg.connect(
        host='127.0.0.1', port=args.port, dbname=args.database,
        user=args.user, password=os.environ.get('PGPASSWORD')
    ) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute('SELECT current_database(), inet_server_addr()::text')
                dbname, host = cur.fetchone()
                if dbname != args.database or host not in ('127.0.0.1', '127.0.0.1/32', '::1', None):
                    raise RuntimeError('Local recovery database safety check failed')

                for required_relation in ('public.clinics', 'private.main_clinic', 'auth.users'):
                    cur.execute('SELECT to_regclass(%s)', (required_relation,))
                    if cur.fetchone()[0] is None:
                        raise RuntimeError(f'Required schema object is missing: {required_relation}')

                # Require a fresh recovery database: no existing clinic row, global
                # main-clinic setting, or clinic-scoped rows for this clinic.
                cur.execute('SELECT 1 FROM public.clinics WHERE id = %s', (clinic_id,))
                if cur.fetchone():
                    raise RuntimeError('Clinic already exists: use a fresh recovery database')
                cur.execute('SELECT 1 FROM private.main_clinic WHERE singleton LIMIT 1')
                if cur.fetchone():
                    raise RuntimeError('private.main_clinic is already configured: use a fresh recovery database')

                for fullname in tables:
                    schema, table = fullname.split('.')
                    cur.execute(sql.SQL('SELECT 1 FROM {}.{} WHERE clinic_id = %s LIMIT 1').format(
                        sql.Identifier(schema), sql.Identifier(table)), (clinic_id,))
                    if cur.fetchone():
                        raise RuntimeError(f'Table {fullname} already contains this clinic')

                # Auth is intentionally not part of the clinic backup. Never fabricate accounts.
                members = tables.get('public.clinic_members', [])
                for member in members:
                    cur.execute('SELECT 1 FROM auth.users WHERE id = %s', (member['user_id'],))
                    if not cur.fetchone():
                        raise RuntimeError(
                            'Missing auth.users account: restore Auth accounts separately before importing'
                        )

                columns = list(clinic)
                cur.execute(sql.SQL('INSERT INTO public.clinics ({}) VALUES ({})').format(
                    sql.SQL(',').join(map(sql.Identifier, columns)),
                    sql.SQL(',').join(sql.Placeholder() for _ in columns)),
                    [json.dumps(clinic[c], ensure_ascii=False) if isinstance(clinic[c], (dict, list)) else clinic[c]
                     for c in columns])

                # private.main_clinic is global and deliberately excluded from the
                # clinic JSON. Recreate its one required mapping before importing
                # clinic_access_requests, whose FK targets this table.
                cur.execute(
                    'INSERT INTO private.main_clinic (singleton, clinic_id, admin_email) VALUES (TRUE, %s, %s)',
                    (clinic_id, args.admin_email.strip().lower()),
                )

                # Only this local transaction: defer/skip FK triggers during row import,
                # then re-add the FKs below so PostgreSQL validates all imported rows.
                cur.execute('SET LOCAL session_replication_role = replica')
                for fullname, rows in sorted(tables.items()):
                    if not rows:
                        continue
                    schema, table = fullname.split('.')
                    cur.execute('''SELECT column_name, is_generated, udt_name, is_nullable
                                   FROM information_schema.columns
                                   WHERE table_schema = %s AND table_name = %s
                                   ORDER BY ordinal_position''', (schema, table))
                    metadata = cur.fetchall()
                    if not metadata:
                        raise RuntimeError(f'Missing table {fullname}')
                    cols = [(c, udt, nullable) for c, generated, udt, nullable in metadata
                            if generated == 'NEVER']
                    names = [c for c, _, _ in cols]
                    known_columns = {c for c, _, _, _ in metadata}
                    for row in rows:
                        unexpected = set(row) - known_columns
                        if unexpected:
                            raise RuntimeError(f'Unexpected columns in {fullname}: {unexpected}')

                    # jsonb_populate_recordset maps JSON null to SQL NULL. Preserve
                    # JSON literal null only for NOT NULL json/jsonb columns; nullable
                    # JSON columns must retain SQL NULL when the backup contains null.
                    selections = []
                    for column, udt, nullable in cols:
                        if udt in ('json', 'jsonb') and nullable == 'NO':
                            selections.append(sql.SQL('COALESCE({}, %s::{})').format(
                                sql.Identifier(column), sql.SQL(udt)))
                        else:
                            selections.append(sql.Identifier(column))

                    query = sql.SQL(
                        'INSERT INTO {}.{} ({}) OVERRIDING SYSTEM VALUE '
                        'SELECT {} FROM jsonb_populate_recordset(NULL::{}.{}, %s::jsonb)'
                    ).format(
                        sql.Identifier(schema), sql.Identifier(table),
                        sql.SQL(',').join(map(sql.Identifier, names)),
                        sql.SQL(',').join(selections), sql.Identifier(schema), sql.Identifier(table)
                    )
                    json_count = sum(
                        udt in ('json', 'jsonb') and nullable == 'NO'
                        for _, udt, nullable in cols
                    )
                    cur.execute(query, ['null'] * json_count + [json.dumps(rows, ensure_ascii=False)])
                    print(f'{fullname}: {len(rows)}')

                # Re-enable normal FK checks and validate all public/private FKs.
                cur.execute('SET LOCAL session_replication_role = origin')
                cur.execute('''SELECT conrelid::regclass::text, conname, pg_get_constraintdef(oid)
                               FROM pg_constraint WHERE contype = 'f'
                               AND connamespace IN ('public'::regnamespace, 'private'::regnamespace)''')
                constraints = cur.fetchall()
                for relation, name, definition in constraints:
                    cur.execute(sql.SQL('ALTER TABLE {} DROP CONSTRAINT {}').format(
                        sql.SQL(relation), sql.Identifier(name)))
                    cur.execute(sql.SQL('ALTER TABLE {} ADD CONSTRAINT {} {}').format(
                        sql.SQL(relation), sql.Identifier(name), sql.SQL(definition)))

                # Remember identity sequences to advance only after all FK checks pass.
                cur.execute('''SELECT n.nspname, t.relname, a.attname,
                                      pg_get_serial_sequence(format('%I.%I', n.nspname,t.relname), a.attname)
                               FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid
                               JOIN pg_namespace n ON n.oid=t.relnamespace
                               WHERE a.attidentity <> '' AND n.nspname IN ('public','private')''')
                for schema, table, column, sequence in cur.fetchall():
                    cur.execute(sql.SQL('SELECT max({}) FROM {}.{}').format(
                        sql.Identifier(column), sql.Identifier(schema), sql.Identifier(table)))
                    max_id = cur.fetchone()[0]
                    if sequence and max_id is not None:
                        sequence_updates.append((sequence, max_id))

                print(f'Foreign keys validated: {len(constraints)}')

        # The data transaction has committed successfully; now advance identity sequences.
        with conn.cursor() as cur:
            for sequence, max_id in sequence_updates:
                cur.execute('SELECT setval(%s::regclass, %s, TRUE)', (sequence, max_id))

    print('COMMITTED: local restore completed; identity sequences updated.')


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Create encrypted, clinic-scoped JSON snapshots from the Nexodent Supabase database.

This is a backup-only component. It never writes to the database and never prints row data.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

import psycopg
from psycopg import sql
from psycopg.rows import tuple_row

DATABASE_URL = os.environ.get("DATABASE_URL", "")
AGE_RECIPIENT = os.environ.get("AGE_RECIPIENT", "")
OUT_DIR = Path(os.environ.get("BACKUP_OUTPUT_DIR", "individual-backups"))
BATCH_SIZE = 500


def require_environment() -> None:
    if not DATABASE_URL:
        raise SystemExit("ERRO: falta DATABASE_URL.")
    if not AGE_RECIPIENT.startswith("age1"):
        raise SystemExit("ERRO: AGE_RECIPIENT ausente ou inválido.")
    if not shutil_which("age"):
        raise SystemExit("ERRO: ferramenta age não encontrada.")


def shutil_which(name: str) -> str | None:
    from shutil import which
    return which(name)


def dump_table(conn, schema: str, table: str, clinic_id: str) -> list[dict]:
    query = sql.SQL("SELECT to_jsonb(t) FROM {}.{} AS t WHERE t.clinic_id = %s::uuid").format(
        sql.Identifier(schema), sql.Identifier(table)
    )
    with conn.cursor(row_factory=tuple_row) as cur:
        cur.execute(query, (clinic_id,))
        # Clinic exports are expected to be manageable; fail safely rather than silently truncate.
        return [row[0] for row in cur.fetchall()]


def main() -> int:
    require_environment()
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Never mix old artifacts into a new run.
    for old in OUT_DIR.iterdir():
        if old.is_file():
            old.unlink()
        elif old.is_dir():
            raise SystemExit(f"ERRO: diretório inesperado dentro de {OUT_DIR}: {old.name}")

    with psycopg.connect(DATABASE_URL, connect_timeout=20) as conn:
        with conn.cursor(row_factory=tuple_row) as cur:
            cur.execute("SELECT id::text, nome FROM public.clinics ORDER BY id")
            clinics = cur.fetchall()
            cur.execute("""
                SELECT c.table_schema, c.table_name
                FROM information_schema.columns c
                JOIN information_schema.tables t
                  ON t.table_schema = c.table_schema AND t.table_name = c.table_name
                WHERE c.column_name = 'clinic_id'
                  AND c.table_schema IN ('public', 'private')
                  AND t.table_type = 'BASE TABLE'
                  AND NOT (c.table_schema = 'private' AND c.table_name = 'main_clinic')
                ORDER BY c.table_schema, c.table_name
            """)
            scoped_tables = cur.fetchall()

        if not clinics:
            raise SystemExit("ERRO: nenhuma clínica encontrada; nenhum backup foi gerado.")

        print(f"Clínicas encontradas: {len(clinics)}")
        print(f"Tabelas com clinic_id incluídas por clínica: {len(scoped_tables) + 1} (inclui public.clinics)")

        total_encrypted = 0
        for clinic_id, clinic_name in clinics:
            with conn.transaction():
                with conn.cursor(row_factory=tuple_row) as cur:
                    cur.execute("SELECT to_jsonb(c) FROM public.clinics c WHERE c.id = %s::uuid", (clinic_id,))
                    clinic_row = cur.fetchone()
                if not clinic_row or clinic_row[0] is None:
                    raise RuntimeError(f"Clínica {clinic_id} não encontrada durante a exportação.")

                payload = {
                    "format": "nexodent-clinic-backup",
                    "format_version": 1,
                    "exported_at": datetime.now(timezone.utc).isoformat(),
                    "clinic": clinic_row[0],
                    "clinic_id": clinic_id,
                    "tables": {},
                    "scope": {
                        "included": "Linhas de public/private que possuem clinic_id, mais public.clinics da clínica.",
                        "excluded": [
                            "Contas e credenciais globais do Supabase Auth (auth.users e demais tabelas auth).",
                            "Arquivos binários do Supabase Storage; tabelas storage não têm vínculo clinic_id confiável no esquema atual.",
                            "Tabelas globais de catálogo/configuração sem clinic_id.",
                            "private.main_clinic, que é configuração global e não deve ser restaurada por clínica."
                        ],
                        "restore_mode": "Ainda não implementado por este componente; este arquivo é somente exportação."
                    }
                }
                for schema, table in scoped_tables:
                    payload["tables"][f"{schema}.{table}"] = dump_table(conn, schema, table, clinic_id)

                safe_id = "".join(ch for ch in clinic_id if ch.isalnum() or ch in "-_")
                plain_path = OUT_DIR / f"clinic-{safe_id}.json"
                encrypted_path = OUT_DIR / f"clinic-{safe_id}.json.age"
                try:
                    with plain_path.open("w", encoding="utf-8") as handle:
                        json.dump(payload, handle, ensure_ascii=False, separators=(",", ":"), default=str)
                    subprocess.run(
                        ["age", "-r", AGE_RECIPIENT, "-o", str(encrypted_path), str(plain_path)],
                        check=True,
                        stdout=subprocess.DEVNULL,
                    )
                    if not encrypted_path.is_file() or encrypted_path.stat().st_size == 0:
                        raise RuntimeError(f"Arquivo criptografado vazio para a clínica {clinic_id}.")
                finally:
                    if plain_path.exists():
                        plain_path.unlink()

                counts = sum(len(rows) for rows in payload["tables"].values()) + 1
                print(f"Backup criptografado gerado para clínica {safe_id}: {counts} registros exportados.")
                total_encrypted += 1

        print(f"Concluído: {total_encrypted} backups individuais criptografados.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except subprocess.CalledProcessError:
        print("ERRO: a criptografia age falhou; o backup não deve ser considerado válido.", file=sys.stderr)
        raise SystemExit(1)
    except Exception as exc:
        # Do not print SQL values, clinic names, or row contents.
        print(f"ERRO na exportação individual: {type(exc).__name__}: {exc}", file=sys.stderr)
        raise SystemExit(1)

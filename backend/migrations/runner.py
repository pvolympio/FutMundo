"""
FutMundo Database Migration & Refresh Runner.
Executa migrações SQL versionadas e gerencia o refresh de views materializadas.
"""

import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path
from typing import List, Tuple

import asyncpg

from backend.api.config import get_settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("migration_runner")

MIGRATIONS_DIR = Path(__file__).resolve().parent


async def get_connection() -> asyncpg.Connection:
    """Obtém conexão com o PostgreSQL utilizando DATABASE_URL configurada."""
    settings = get_settings()
    # Conexão direta via URL
    return await asyncpg.connect(settings.DATABASE_URL)


async def ensure_migrations_table(conn: asyncpg.Connection) -> None:
    """Garante a existência da tabela de controle schema_migrations."""
    await conn.execute("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version VARCHAR(64) PRIMARY KEY,
            description TEXT,
            applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
            execution_time_ms INTEGER
        );
    """)


async def get_applied_migrations(conn: asyncpg.Connection) -> dict[str, dict]:
    """Retorna dicionário de migrações já executadas."""
    await ensure_migrations_table(conn)
    rows = await conn.fetch("SELECT version, description, applied_at, execution_time_ms FROM schema_migrations ORDER BY version")
    return {
        r["version"]: {
            "description": r["description"],
            "applied_at": r["applied_at"],
            "execution_time_ms": r["execution_time_ms"],
        }
        for r in rows
    }


def get_migration_files() -> List[Tuple[str, Path]]:
    """Localiza todos os arquivos .sql no diretório de migrações ordenados numericamente."""
    files = sorted(MIGRATIONS_DIR.glob("*.sql"))
    return [(f.stem, f) for f in files]


async def run_migrations() -> None:
    """Aplica todas as migrações pendentes em ordem."""
    conn = await get_connection()
    try:
        applied = await get_applied_migrations(conn)
        available = get_migration_files()

        pending = [(v, p) for v, p in available if v not in applied]

        if not pending:
            logger.info("Nenhuma migração pendente. Banco de dados está 100% atualizado.")
            return

        logger.info("Encontradas %d migrações pendentes para aplicar.", len(pending))

        for version, path in pending:
            sql_content = path.read_text(encoding="utf-8")
            logger.info("Aplicando migração: %s...", version)

            start_time = time.time()
            async with conn.transaction():
                await conn.execute(sql_content)
                elapsed_ms = int((time.time() - start_time) * 1000)
                await conn.execute(
                    """
                    INSERT INTO schema_migrations (version, description, applied_at, execution_time_ms)
                    VALUES ($1, $2, clock_timestamp(), $3)
                    ON CONFLICT (version) DO NOTHING
                    """,
                    version,
                    path.name,
                    elapsed_ms,
                )

            logger.info("✓ Migração %s aplicada com sucesso (%d ms)", version, elapsed_ms)

        logger.info("Todas as migrações foram concluídas com sucesso.")
    finally:
        await conn.close()


async def show_status() -> None:
    """Exibe o status de cada migração disponível."""
    conn = await get_connection()
    try:
        applied = await get_applied_migrations(conn)
        available = get_migration_files()

        print("\n" + "=" * 70)
        print("  FUTMUNDO — STATUS DAS MIGRAÇÕES DE BANCO DE DADOS")
        print("=" * 70)
        print(f"{'Versão':<35} | {'Status':<10} | {'Aplicado em':<20}")
        print("-" * 70)

        for version, path in available:
            if version in applied:
                info = applied[version]
                dt_str = info["applied_at"].strftime("%Y-%m-%d %H:%M:%S")
                print(f"{version:<35} | \033[92mAPLICADO\033[0m   | {dt_str:<20}")
            else:
                print(f"{version:<35} | \033[93mPENDENTE\033[0m   | {'-':<20}")

        print("=" * 70 + "\n")
    finally:
        await conn.close()


async def refresh_views(concurrently: bool = False) -> None:
    """Executa a atualização das views materializadas e exibe a auditoria."""
    conn = await get_connection()
    try:
        mode = "CONCURRENTLY" if concurrently else "PADRÃO"
        logger.info("Iniciando refresh das views materializadas (Modo: %s)...", mode)

        start_time = time.time()
        await conn.execute("SELECT refresh_gold_views($1)", concurrently)
        elapsed_ms = int((time.time() - start_time) * 1000)

        logger.info("✓ Refresh executado em %d ms", elapsed_ms)

        # Consulta log de auditoria
        rows = await conn.fetch(
            "SELECT view_name, last_refreshed_at, refresh_duration_ms, status FROM matview_refresh_log ORDER BY view_name"
        )
        print("\n" + "=" * 65)
        print("  AUDITORIA DE ATUALIZAÇÃO DAS VIEWS MATERIALIZADAS")
        print("=" * 65)
        for r in rows:
            dt = r["last_refreshed_at"].strftime("%Y-%m-%d %H:%M:%S")
            dur = r["refresh_duration_ms"] or 0
            print(f"• {r['view_name']:<30} | {dt} | {dur} ms | {r['status']}")
        print("=" * 65 + "\n")
    finally:
        await conn.close()


def main():
    parser = argparse.ArgumentParser(description="FutMundo Migration & View Refresh CLI")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # Subcomando: migrate
    subparsers.add_parser("migrate", help="Aplica todas as migrações SQL pendentes")

    # Subcomando: status
    subparsers.add_parser("status", help="Exibe o status das migrações")

    # Subcomando: refresh-views
    refresh_parser = subparsers.add_parser("refresh-views", help="Executa o refresh das views materializadas")
    refresh_parser.add_argument(
        "--concurrently",
        action="store_true",
        help="Executa refresh concorrente sem bloquear leituras (requer índices únicos)",
    )

    args = parser.parse_args()

    if args.command == "migrate":
        asyncio.run(run_migrations())
    elif args.command == "status":
        asyncio.run(show_status())
    elif args.command == "refresh-views":
        asyncio.run(refresh_views(concurrently=args.concurrently))


if __name__ == "__main__":
    main()

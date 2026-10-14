from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base


def _prepare_sqlite_directory(database_url: str) -> None:
    prefix = "sqlite:///"
    if database_url.startswith(prefix) and database_url != "sqlite:///:memory:":
        Path(database_url[len(prefix):]).parent.mkdir(parents=True, exist_ok=True)


def create_session_factory(database_url: str) -> sessionmaker[Session]:
    import app.models.category  # noqa: F401  registers tables on Base.metadata
    import app.models.commerce  # noqa: F401
    import app.models.event  # noqa: F401
    import app.models.product  # noqa: F401
    import app.models.user  # noqa: F401

    _prepare_sqlite_directory(database_url)
    connect_args = {"check_same_thread": False} if database_url.startswith("sqlite") else {}
    engine: Engine = create_engine(database_url, connect_args=connect_args)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, expire_on_commit=False)

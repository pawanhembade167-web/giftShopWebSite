"""Gives an existing account the admin role.

Usage (from the backend folder):
    python -m scripts.make_admin you@example.com

The account must already exist: sign up first, then run this command.
"""

import argparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config.database import create_session_factory
from app.config.settings import get_settings
from app.models.user import Role, User


def promote_to_admin(session: Session, email: str) -> User:
    user = session.scalar(select(User).where(User.email == email.strip().lower()))
    if user is None:
        raise ValueError(f"No account exists for {email}. Ask them to sign up first.")
    user.role = Role.ADMIN.value
    session.commit()
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Give an existing account the admin role.")
    parser.add_argument("email")
    args = parser.parse_args()
    session_factory = create_session_factory(get_settings().database_url)
    with session_factory() as session:
        user = promote_to_admin(session, args.email)
    print(f"{user.email} is now an administrator. They must sign out and sign in again.")


if __name__ == "__main__":
    main()

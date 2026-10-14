"""Creates or updates an administrator account with a password you choose.

Usage (from the backend folder):
    python -m scripts.set_admin_credentials you@example.com

You are asked for the password and the name and phone. The password is typed hidden and is never stored in plain text.
If the account already exists, its password is replaced and it becomes an administrator.
"""

import argparse
import getpass
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth.security import hash_password
from app.config.database import create_session_factory
from app.config.settings import get_settings
from app.models.user import Role, User

MIN_PASSWORD_LENGTH = 8


def _check_password(password: str) -> None:
    if len(password) < MIN_PASSWORD_LENGTH or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise ValueError(f"Use at least {MIN_PASSWORD_LENGTH} characters, with a letter and a number.")


def set_admin_credentials(session: Session, email: str, password: str, full_name: str, phone: str) -> User:
    _check_password(password)
    normalised = email.strip().lower()
    user = session.scalar(select(User).where(User.email == normalised))
    if user is None:
        user = User(full_name=full_name, email=normalised, phone=phone, password_hash="", role=Role.ADMIN.value)
        session.add(user)
    user.password_hash = hash_password(password)
    user.role = Role.ADMIN.value
    user.is_active = True
    session.commit()
    return user


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update an administrator account.")
    parser.add_argument("email")
    args = parser.parse_args()
    full_name = input("Full name [Store Admin]: ").strip() or "Store Admin"
    phone = input("Phone number: ").strip() or "0000000000"
    password = getpass.getpass("Password (hidden): ")
    if password != getpass.getpass("Repeat password (hidden): "):
        raise SystemExit("The two passwords do not match. Nothing was changed.")
    session_factory = create_session_factory(get_settings().database_url)
    with session_factory() as session:
        try:
            user = set_admin_credentials(session, args.email, password, full_name, phone)
        except ValueError as error:
            raise SystemExit(str(error))
    print(f"Administrator ready: {user.email}. Sign in at /login, then open /admin.")


if __name__ == "__main__":
    main()

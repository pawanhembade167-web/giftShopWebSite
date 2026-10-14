from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, session: Session):
        self._session = session

    def get_by_email(self, email: str) -> User | None:
        return self._session.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: int) -> User | None:
        return self._session.get(User, user_id)

    def add(self, user: User) -> None:
        self._session.add(user)

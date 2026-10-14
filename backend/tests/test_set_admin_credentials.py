import pytest

from app.auth.security import verify_password
from app.models.user import User
from scripts.set_admin_credentials import set_admin_credentials


def test_creates_an_admin_account_with_the_given_password(client):
    session = client.app.state.session_factory()

    set_admin_credentials(session, "owner@example.com", "Secret123", "Store Owner", "9876543210")

    user = session.query(User).filter_by(email="owner@example.com").one()
    assert user.role == "ADMIN"
    assert verify_password(user.password_hash, "Secret123")
    session.close()


def test_updates_the_password_of_an_existing_account_and_keeps_admin_rights(client):
    session = client.app.state.session_factory()
    set_admin_credentials(session, "owner@example.com", "Secret123", "Store Owner", "9876543210")

    set_admin_credentials(session, "owner@example.com", "NewPass456", "Store Owner", "9876543210")

    user = session.query(User).filter_by(email="owner@example.com").one()
    assert verify_password(user.password_hash, "NewPass456")
    assert not verify_password(user.password_hash, "Secret123")
    assert user.role == "ADMIN"
    session.close()


def test_refuses_a_weak_password(client):
    session = client.app.state.session_factory()

    with pytest.raises(ValueError):
        set_admin_credentials(session, "owner@example.com", "short", "Store Owner", "9876543210")
    session.close()

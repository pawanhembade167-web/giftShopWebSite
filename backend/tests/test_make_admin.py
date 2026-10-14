import pytest

from app.models.user import User
from scripts.make_admin import promote_to_admin
from tests.factories import shopper


def test_promote_to_admin_gives_an_existing_customer_the_admin_role(client, settings):
    shopper(client, settings, "staff@example.com")
    session = client.app.state.session_factory()

    promote_to_admin(session, "Staff@Example.com")

    assert session.query(User).filter_by(email="staff@example.com").one().role == "ADMIN"
    session.close()


def test_promote_to_admin_refuses_an_unknown_email(client, settings):
    session = client.app.state.session_factory()

    with pytest.raises(ValueError):
        promote_to_admin(session, "nobody@example.com")
    session.close()

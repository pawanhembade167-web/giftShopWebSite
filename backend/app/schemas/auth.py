import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator
from pydantic.alias_generators import to_camel

PHONE_PATTERN = re.compile(r"^\+?\d{10,15}$")
PHONE_SEPARATORS = re.compile(r"[\s\-()]")
MIN_PASSWORD_LENGTH = 8
MAX_PASSWORD_LENGTH = 128


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class SignUpRequest(CamelModel):
    full_name: str = Field(min_length=2, max_length=100)
    email: EmailStr
    phone: str = Field(max_length=20)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=MAX_PASSWORD_LENGTH)

    @field_validator("full_name")
    @classmethod
    def strip_full_name(cls, value: str) -> str:
        cleaned = value.strip()
        if len(cleaned) < 2:
            raise ValueError("Enter at least 2 characters.")
        return cleaned

    @field_validator("phone")
    @classmethod
    def normalise_phone(cls, value: str) -> str:
        cleaned = PHONE_SEPARATORS.sub("", value)
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError("Enter a valid phone number with 10 to 15 digits.")
        return cleaned

    @field_validator("password")
    @classmethod
    def require_letter_and_digit(cls, value: str) -> str:
        if not any(char.isalpha() for char in value) or not any(char.isdigit() for char in value):
            raise ValueError("Password must contain a letter and a number.")
        return value


class LoginRequest(CamelModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=MAX_PASSWORD_LENGTH)


class UserOut(CamelModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)

    id: int
    full_name: str
    email: str
    phone: str
    role: str

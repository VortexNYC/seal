from enum import StrEnum


class FieldType(StrEnum):
    ATTACHMENT = "attachment"
    CHECKBOX = "checkbox"
    DATE = "date"
    DROPDOWN = "dropdown"
    RADIO = "radio"
    SIGNATURE = "signature"
    TEXT = "text"

    def __str__(self) -> str:
        return str(self.value)

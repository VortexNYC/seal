from enum import StrEnum


class SignatureMethod(StrEnum):
    DRAW = "draw"
    TYPE = "type"
    UPLOAD = "upload"

    def __str__(self) -> str:
        return str(self.value)

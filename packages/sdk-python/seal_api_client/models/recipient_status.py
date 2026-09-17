from enum import StrEnum


class RecipientStatus(StrEnum):
    APPROVED = "approved"
    DECLINED = "declined"
    PENDING = "pending"
    SIGNED = "signed"
    VIEWED = "viewed"

    def __str__(self) -> str:
        return str(self.value)

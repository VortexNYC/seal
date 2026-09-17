from enum import StrEnum


class DocumentStatus(StrEnum):
    CANCELLED = "cancelled"
    COMPLETED = "completed"
    DECLINED = "declined"
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    SENT = "sent"

    def __str__(self) -> str:
        return str(self.value)

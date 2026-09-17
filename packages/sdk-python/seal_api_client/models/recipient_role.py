from enum import StrEnum


class RecipientRole(StrEnum):
    APPROVER = "approver"
    SIGNER = "signer"
    VIEWER = "viewer"

    def __str__(self) -> str:
        return str(self.value)

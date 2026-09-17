from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

T = TypeVar("T", bound="VerificationResultSignaturesItem")


@_attrs_define
class VerificationResultSignaturesItem:
    """
    Attributes:
        id (str):
        recipient_email (str):
        is_valid (bool):
        signed_at (datetime.datetime):
        signature_hash (str):
    """

    id: str
    recipient_email: str
    is_valid: bool
    signed_at: datetime.datetime
    signature_hash: str
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        recipient_email = self.recipient_email

        is_valid = self.is_valid

        signed_at = self.signed_at.isoformat()

        signature_hash = self.signature_hash

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "recipient_email": recipient_email,
                "is_valid": is_valid,
                "signed_at": signed_at,
                "signature_hash": signature_hash,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        recipient_email = d.pop("recipient_email")

        is_valid = d.pop("is_valid")

        signed_at = datetime.datetime.fromisoformat(d.pop("signed_at"))

        signature_hash = d.pop("signature_hash")

        verification_result_signatures_item = cls(
            id=id,
            recipient_email=recipient_email,
            is_valid=is_valid,
            signed_at=signed_at,
            signature_hash=signature_hash,
        )

        verification_result_signatures_item.additional_properties = d
        return verification_result_signatures_item

    @property
    def additional_keys(self) -> list[str]:
        return list(self.additional_properties.keys())

    def __getitem__(self, key: str) -> Any:
        return self.additional_properties[key]

    def __setitem__(self, key: str, value: Any) -> None:
        self.additional_properties[key] = value

    def __delitem__(self, key: str) -> None:
        del self.additional_properties[key]

    def __contains__(self, key: str) -> bool:
        return key in self.additional_properties

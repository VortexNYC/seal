from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

if TYPE_CHECKING:
    from ..models.verification_result_signatures_item import VerificationResultSignaturesItem


T = TypeVar("T", bound="VerificationResult")


@_attrs_define
class VerificationResult:
    """
    Attributes:
        is_valid (bool): True if all signatures are cryptographically valid
        document_hash (str): SHA-256 hash of the current document
        verification_timestamp (datetime.datetime):
        signatures (list[VerificationResultSignaturesItem]):
    """

    is_valid: bool
    document_hash: str
    verification_timestamp: datetime.datetime
    signatures: list[VerificationResultSignaturesItem]
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        is_valid = self.is_valid

        document_hash = self.document_hash

        verification_timestamp = self.verification_timestamp.isoformat()

        signatures = []
        for signatures_item_data in self.signatures:
            signatures_item = signatures_item_data.to_dict()
            signatures.append(signatures_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "is_valid": is_valid,
                "document_hash": document_hash,
                "verification_timestamp": verification_timestamp,
                "signatures": signatures,
            }
        )

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.verification_result_signatures_item import VerificationResultSignaturesItem  # noqa: PLC0415

        d = dict(src_dict)
        is_valid = d.pop("is_valid")

        document_hash = d.pop("document_hash")

        verification_timestamp = datetime.datetime.fromisoformat(d.pop("verification_timestamp"))

        signatures = []
        _signatures = d.pop("signatures")
        for signatures_item_data in _signatures:
            signatures_item = VerificationResultSignaturesItem.from_dict(signatures_item_data)

            signatures.append(signatures_item)

        verification_result = cls(
            is_valid=is_valid,
            document_hash=document_hash,
            verification_timestamp=verification_timestamp,
            signatures=signatures,
        )

        verification_result.additional_properties = d
        return verification_result

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

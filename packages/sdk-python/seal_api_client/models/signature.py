from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.signature_method import SignatureMethod
from ..types import UNSET, Unset

T = TypeVar("T", bound="Signature")


@_attrs_define
class Signature:
    """
    Attributes:
        id (str):
        field_id (str):
        recipient_id (str):
        document_id (str):
        signature_method (SignatureMethod):
        signed_at (datetime.datetime):
        signature_image_url (str | Unset):
        signature_hash (str | Unset): SHA-256 hash of the signature data
        ip_address (str | Unset):
        user_agent (str | Unset):
    """

    id: str
    field_id: str
    recipient_id: str
    document_id: str
    signature_method: SignatureMethod
    signed_at: datetime.datetime
    signature_image_url: str | Unset = UNSET
    signature_hash: str | Unset = UNSET
    ip_address: str | Unset = UNSET
    user_agent: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        field_id = self.field_id

        recipient_id = self.recipient_id

        document_id = self.document_id

        signature_method = self.signature_method.value

        signed_at = self.signed_at.isoformat()

        signature_image_url = self.signature_image_url

        signature_hash = self.signature_hash

        ip_address = self.ip_address

        user_agent = self.user_agent

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "field_id": field_id,
                "recipient_id": recipient_id,
                "document_id": document_id,
                "signature_method": signature_method,
                "signed_at": signed_at,
            }
        )
        if signature_image_url is not UNSET:
            field_dict["signature_image_url"] = signature_image_url
        if signature_hash is not UNSET:
            field_dict["signature_hash"] = signature_hash
        if ip_address is not UNSET:
            field_dict["ip_address"] = ip_address
        if user_agent is not UNSET:
            field_dict["user_agent"] = user_agent

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        field_id = d.pop("field_id")

        recipient_id = d.pop("recipient_id")

        document_id = d.pop("document_id")

        signature_method = SignatureMethod(d.pop("signature_method"))

        signed_at = datetime.datetime.fromisoformat(d.pop("signed_at"))

        signature_image_url = d.pop("signature_image_url", UNSET)

        signature_hash = d.pop("signature_hash", UNSET)

        ip_address = d.pop("ip_address", UNSET)

        user_agent = d.pop("user_agent", UNSET)

        signature = cls(
            id=id,
            field_id=field_id,
            recipient_id=recipient_id,
            document_id=document_id,
            signature_method=signature_method,
            signed_at=signed_at,
            signature_image_url=signature_image_url,
            signature_hash=signature_hash,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        signature.additional_properties = d
        return signature

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

from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.recipient_role import RecipientRole
from ..models.recipient_status import RecipientStatus
from ..types import UNSET, Unset

T = TypeVar("T", bound="Recipient")


@_attrs_define
class Recipient:
    """
    Attributes:
        id (str):
        email (str):
        name (str):
        role (RecipientRole): - `signer` — must provide a signature to complete the document
            - `approver` — must click Approve; no signature drawn
            - `viewer` — receives a copy but has no action required
        status (RecipientStatus):
        order (int | Unset): Position in sequential signing order
        signed_at (datetime.datetime | Unset):
        viewed_at (datetime.datetime | Unset):
        declined_at (datetime.datetime | Unset):
        decline_reason (str | Unset):
    """

    id: str
    email: str
    name: str
    role: RecipientRole
    status: RecipientStatus
    order: int | Unset = UNSET
    signed_at: datetime.datetime | Unset = UNSET
    viewed_at: datetime.datetime | Unset = UNSET
    declined_at: datetime.datetime | Unset = UNSET
    decline_reason: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        email = self.email

        name = self.name

        role = self.role.value

        status = self.status.value

        order = self.order

        signed_at: str | Unset = UNSET
        if not isinstance(self.signed_at, Unset):
            signed_at = self.signed_at.isoformat()

        viewed_at: str | Unset = UNSET
        if not isinstance(self.viewed_at, Unset):
            viewed_at = self.viewed_at.isoformat()

        declined_at: str | Unset = UNSET
        if not isinstance(self.declined_at, Unset):
            declined_at = self.declined_at.isoformat()

        decline_reason = self.decline_reason

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "email": email,
                "name": name,
                "role": role,
                "status": status,
            }
        )
        if order is not UNSET:
            field_dict["order"] = order
        if signed_at is not UNSET:
            field_dict["signed_at"] = signed_at
        if viewed_at is not UNSET:
            field_dict["viewed_at"] = viewed_at
        if declined_at is not UNSET:
            field_dict["declined_at"] = declined_at
        if decline_reason is not UNSET:
            field_dict["decline_reason"] = decline_reason

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        id = d.pop("id")

        email = d.pop("email")

        name = d.pop("name")

        role = RecipientRole(d.pop("role"))

        status = RecipientStatus(d.pop("status"))

        order = d.pop("order", UNSET)

        _signed_at = d.pop("signed_at", UNSET)
        signed_at: datetime.datetime | Unset
        if isinstance(_signed_at, Unset):
            signed_at = UNSET
        else:
            signed_at = datetime.datetime.fromisoformat(_signed_at)

        _viewed_at = d.pop("viewed_at", UNSET)
        viewed_at: datetime.datetime | Unset
        if isinstance(_viewed_at, Unset):
            viewed_at = UNSET
        else:
            viewed_at = datetime.datetime.fromisoformat(_viewed_at)

        _declined_at = d.pop("declined_at", UNSET)
        declined_at: datetime.datetime | Unset
        if isinstance(_declined_at, Unset):
            declined_at = UNSET
        else:
            declined_at = datetime.datetime.fromisoformat(_declined_at)

        decline_reason = d.pop("decline_reason", UNSET)

        recipient = cls(
            id=id,
            email=email,
            name=name,
            role=role,
            status=status,
            order=order,
            signed_at=signed_at,
            viewed_at=viewed_at,
            declined_at=declined_at,
            decline_reason=decline_reason,
        )

        recipient.additional_properties = d
        return recipient

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

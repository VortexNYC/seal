from __future__ import annotations

from collections.abc import Mapping
from typing import Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.recipient_role import RecipientRole
from ..types import UNSET, Unset

T = TypeVar("T", bound="UpdateRecipientBody")


@_attrs_define
class UpdateRecipientBody:
    """
    Attributes:
        name (str | Unset):
        role (RecipientRole | Unset): - `signer` — must provide a signature to complete the document
            - `approver` — must click Approve; no signature drawn
            - `viewer` — receives a copy but has no action required
        order (int | Unset):
        message (str | Unset):
    """

    name: str | Unset = UNSET
    role: RecipientRole | Unset = UNSET
    order: int | Unset = UNSET
    message: str | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        name = self.name

        role: str | Unset = UNSET
        if not isinstance(self.role, Unset):
            role = self.role.value

        order = self.order

        message = self.message

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if name is not UNSET:
            field_dict["name"] = name
        if role is not UNSET:
            field_dict["role"] = role
        if order is not UNSET:
            field_dict["order"] = order
        if message is not UNSET:
            field_dict["message"] = message

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        d = dict(src_dict)
        name = d.pop("name", UNSET)

        _role = d.pop("role", UNSET)
        role: RecipientRole | Unset
        if isinstance(_role, Unset):
            role = UNSET
        else:
            role = RecipientRole(_role)

        order = d.pop("order", UNSET)

        message = d.pop("message", UNSET)

        update_recipient_body = cls(
            name=name,
            role=role,
            order=order,
            message=message,
        )

        update_recipient_body.additional_properties = d
        return update_recipient_body

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

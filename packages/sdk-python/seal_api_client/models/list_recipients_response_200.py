from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.recipient import Recipient


T = TypeVar("T", bound="ListRecipientsResponse200")


@_attrs_define
class ListRecipientsResponse200:
    """
    Attributes:
        recipients (list[Recipient] | Unset):
    """

    recipients: list[Recipient] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        recipients: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.recipients, Unset):
            recipients = []
            for recipients_item_data in self.recipients:
                recipients_item = recipients_item_data.to_dict()
                recipients.append(recipients_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update({})
        if recipients is not UNSET:
            field_dict["recipients"] = recipients

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.recipient import Recipient  # noqa: PLC0415

        d = dict(src_dict)
        _recipients = d.pop("recipients", UNSET)
        recipients: list[Recipient] | Unset = UNSET
        if _recipients is not UNSET:
            recipients = []
            for recipients_item_data in _recipients:
                recipients_item = Recipient.from_dict(recipients_item_data)

                recipients.append(recipients_item)

        list_recipients_response_200 = cls(
            recipients=recipients,
        )

        list_recipients_response_200.additional_properties = d
        return list_recipients_response_200

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

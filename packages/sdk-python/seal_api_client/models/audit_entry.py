from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.audit_entry_details import AuditEntryDetails


T = TypeVar("T", bound="AuditEntry")


@_attrs_define
class AuditEntry:
    """
    Attributes:
        id (str):
        event_type (str): Dot-separated action identifier, e.g. `document.viewed`, `recipient.signed`,
            `document.completed`
        timestamp (datetime.datetime):
        actor_email (str | Unset):
        actor_name (str | Unset):
        ip_address (str | Unset):
        user_agent (str | Unset):
        details (AuditEntryDetails | Unset):
    """

    id: str
    event_type: str
    timestamp: datetime.datetime
    actor_email: str | Unset = UNSET
    actor_name: str | Unset = UNSET
    ip_address: str | Unset = UNSET
    user_agent: str | Unset = UNSET
    details: AuditEntryDetails | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        event_type = self.event_type

        timestamp = self.timestamp.isoformat()

        actor_email = self.actor_email

        actor_name = self.actor_name

        ip_address = self.ip_address

        user_agent = self.user_agent

        details: dict[str, Any] | Unset = UNSET
        if not isinstance(self.details, Unset):
            details = self.details.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "event_type": event_type,
                "timestamp": timestamp,
            }
        )
        if actor_email is not UNSET:
            field_dict["actor_email"] = actor_email
        if actor_name is not UNSET:
            field_dict["actor_name"] = actor_name
        if ip_address is not UNSET:
            field_dict["ip_address"] = ip_address
        if user_agent is not UNSET:
            field_dict["user_agent"] = user_agent
        if details is not UNSET:
            field_dict["details"] = details

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.audit_entry_details import AuditEntryDetails  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        event_type = d.pop("event_type")

        timestamp = datetime.datetime.fromisoformat(d.pop("timestamp"))

        actor_email = d.pop("actor_email", UNSET)

        actor_name = d.pop("actor_name", UNSET)

        ip_address = d.pop("ip_address", UNSET)

        user_agent = d.pop("user_agent", UNSET)

        _details = d.pop("details", UNSET)
        details: AuditEntryDetails | Unset
        if isinstance(_details, Unset):
            details = UNSET
        else:
            details = AuditEntryDetails.from_dict(_details)

        audit_entry = cls(
            id=id,
            event_type=event_type,
            timestamp=timestamp,
            actor_email=actor_email,
            actor_name=actor_name,
            ip_address=ip_address,
            user_agent=user_agent,
            details=details,
        )

        audit_entry.additional_properties = d
        return audit_entry

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

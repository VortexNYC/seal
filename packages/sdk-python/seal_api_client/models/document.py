from __future__ import annotations

import datetime
from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..models.document_status import DocumentStatus
from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.recipient import Recipient


T = TypeVar("T", bound="Document")


@_attrs_define
class Document:
    """
    Attributes:
        id (str): Unique document identifier
        title (str):
        status (DocumentStatus): Current workflow status of a document
        created_at (datetime.datetime):
        updated_at (datetime.datetime):
        recipients_count (int): Total number of recipients
        signed_count (int): Number of recipients who have completed their action
        description (str | Unset):
        deadline (datetime.datetime | Unset): Signing deadline
        download_url (str | Unset): Pre-signed URL to download the document PDF
        recipients (list[Recipient] | Unset): Recipient list (only included when include_recipients=true)
    """

    id: str
    title: str
    status: DocumentStatus
    created_at: datetime.datetime
    updated_at: datetime.datetime
    recipients_count: int
    signed_count: int
    description: str | Unset = UNSET
    deadline: datetime.datetime | Unset = UNSET
    download_url: str | Unset = UNSET
    recipients: list[Recipient] | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        id = self.id

        title = self.title

        status = self.status.value

        created_at = self.created_at.isoformat()

        updated_at = self.updated_at.isoformat()

        recipients_count = self.recipients_count

        signed_count = self.signed_count

        description = self.description

        deadline: str | Unset = UNSET
        if not isinstance(self.deadline, Unset):
            deadline = self.deadline.isoformat()

        download_url = self.download_url

        recipients: list[dict[str, Any]] | Unset = UNSET
        if not isinstance(self.recipients, Unset):
            recipients = []
            for recipients_item_data in self.recipients:
                recipients_item = recipients_item_data.to_dict()
                recipients.append(recipients_item)

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "id": id,
                "title": title,
                "status": status,
                "created_at": created_at,
                "updated_at": updated_at,
                "recipients_count": recipients_count,
                "signed_count": signed_count,
            }
        )
        if description is not UNSET:
            field_dict["description"] = description
        if deadline is not UNSET:
            field_dict["deadline"] = deadline
        if download_url is not UNSET:
            field_dict["download_url"] = download_url
        if recipients is not UNSET:
            field_dict["recipients"] = recipients

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.recipient import Recipient  # noqa: PLC0415

        d = dict(src_dict)
        id = d.pop("id")

        title = d.pop("title")

        status = DocumentStatus(d.pop("status"))

        created_at = datetime.datetime.fromisoformat(d.pop("created_at"))

        updated_at = datetime.datetime.fromisoformat(d.pop("updated_at"))

        recipients_count = d.pop("recipients_count")

        signed_count = d.pop("signed_count")

        description = d.pop("description", UNSET)

        _deadline = d.pop("deadline", UNSET)
        deadline: datetime.datetime | Unset
        if isinstance(_deadline, Unset):
            deadline = UNSET
        else:
            deadline = datetime.datetime.fromisoformat(_deadline)

        download_url = d.pop("download_url", UNSET)

        _recipients = d.pop("recipients", UNSET)
        recipients: list[Recipient] | Unset = UNSET
        if _recipients is not UNSET:
            recipients = []
            for recipients_item_data in _recipients:
                recipients_item = Recipient.from_dict(recipients_item_data)

                recipients.append(recipients_item)

        document = cls(
            id=id,
            title=title,
            status=status,
            created_at=created_at,
            updated_at=updated_at,
            recipients_count=recipients_count,
            signed_count=signed_count,
            description=description,
            deadline=deadline,
            download_url=download_url,
            recipients=recipients,
        )

        document.additional_properties = d
        return document

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

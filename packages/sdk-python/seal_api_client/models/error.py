from __future__ import annotations

from collections.abc import Mapping
from typing import TYPE_CHECKING, Any, TypeVar

from attrs import define as _attrs_define
from attrs import field as _attrs_field

from ..types import UNSET, Unset

if TYPE_CHECKING:
    from ..models.error_details import ErrorDetails


T = TypeVar("T", bound="Error")


@_attrs_define
class Error:
    """
    Attributes:
        type_ (str): Machine-readable error code Example: VALIDATION_ERROR.
        status (int): HTTP status code Example: 400.
        title (str): Human-readable error message
        details (ErrorDetails | Unset): Field-level validation errors
    """

    type_: str
    status: int
    title: str
    details: ErrorDetails | Unset = UNSET
    additional_properties: dict[str, Any] = _attrs_field(init=False, factory=dict)

    def to_dict(self) -> dict[str, Any]:
        type_ = self.type_

        status = self.status

        title = self.title

        details: dict[str, Any] | Unset = UNSET
        if not isinstance(self.details, Unset):
            details = self.details.to_dict()

        field_dict: dict[str, Any] = {}
        field_dict.update(self.additional_properties)
        field_dict.update(
            {
                "type": type_,
                "status": status,
                "title": title,
            }
        )
        if details is not UNSET:
            field_dict["details"] = details

        return field_dict

    @classmethod
    def from_dict(cls: type[T], src_dict: Mapping[str, Any]) -> T:
        from ..models.error_details import ErrorDetails  # noqa: PLC0415

        d = dict(src_dict)
        type_ = d.pop("type")

        status = d.pop("status")

        title = d.pop("title")

        _details = d.pop("details", UNSET)
        details: ErrorDetails | Unset
        if isinstance(_details, Unset):
            details = UNSET
        else:
            details = ErrorDetails.from_dict(_details)

        error = cls(
            type_=type_,
            status=status,
            title=title,
            details=details,
        )

        error.additional_properties = d
        return error

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

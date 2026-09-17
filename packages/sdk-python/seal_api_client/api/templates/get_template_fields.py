from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.get_template_fields_response_200 import GetTemplateFieldsResponse200
from ...types import UNSET, Response


def _get_kwargs(
    *,
    id: str,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["id"] = id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/templates/fields",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | GetTemplateFieldsResponse200 | None:
    if response.status_code == 200:
        response_200 = GetTemplateFieldsResponse200.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401

    if response.status_code == 404:
        response_404 = Error.from_dict(response.json())

        return response_404

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | GetTemplateFieldsResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    id: str,
) -> Response[Error | GetTemplateFieldsResponse200]:
    """Get template fields

     Returns all field definitions for a template. Fields define where signatures, text inputs, and other
    data entry points are located on the document.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | GetTemplateFieldsResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    id: str,
) -> Error | GetTemplateFieldsResponse200 | None:
    """Get template fields

     Returns all field definitions for a template. Fields define where signatures, text inputs, and other
    data entry points are located on the document.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | GetTemplateFieldsResponse200
    """

    return sync_detailed(
        client=client,
        id=id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    id: str,
) -> Response[Error | GetTemplateFieldsResponse200]:
    """Get template fields

     Returns all field definitions for a template. Fields define where signatures, text inputs, and other
    data entry points are located on the document.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | GetTemplateFieldsResponse200]
    """

    kwargs = _get_kwargs(
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    id: str,
) -> Error | GetTemplateFieldsResponse200 | None:
    """Get template fields

     Returns all field definitions for a template. Fields define where signatures, text inputs, and other
    data entry points are located on the document.

    Args:
        id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | GetTemplateFieldsResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            id=id,
        )
    ).parsed

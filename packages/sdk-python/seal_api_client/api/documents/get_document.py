from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.document import Document
from ...models.error import Error
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    id: str,
    include_recipients: bool | Unset = False,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["id"] = id

    params["include_recipients"] = include_recipients

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/documents/get",
        "params": params,
    }

    return _kwargs


def _parse_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Document | Error | None:
    if response.status_code == 200:
        response_200 = Document.from_dict(response.json())

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


def _build_response(*, client: AuthenticatedClient | Client, response: httpx.Response) -> Response[Document | Error]:
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
    include_recipients: bool | Unset = False,
) -> Response[Document | Error]:
    """Get a document

    Args:
        id (str):
        include_recipients (bool | Unset):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Document | Error]
    """

    kwargs = _get_kwargs(
        id=id,
        include_recipients=include_recipients,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    id: str,
    include_recipients: bool | Unset = False,
) -> Document | Error | None:
    """Get a document

    Args:
        id (str):
        include_recipients (bool | Unset):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Document | Error
    """

    return sync_detailed(
        client=client,
        id=id,
        include_recipients=include_recipients,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    id: str,
    include_recipients: bool | Unset = False,
) -> Response[Document | Error]:
    """Get a document

    Args:
        id (str):
        include_recipients (bool | Unset):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Document | Error]
    """

    kwargs = _get_kwargs(
        id=id,
        include_recipients=include_recipients,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    id: str,
    include_recipients: bool | Unset = False,
) -> Document | Error | None:
    """Get a document

    Args:
        id (str):
        include_recipients (bool | Unset):  Default: False.

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Document | Error
    """

    return (
        await asyncio_detailed(
            client=client,
            id=id,
            include_recipients=include_recipients,
        )
    ).parsed

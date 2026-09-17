from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.document_status import DocumentStatus
from ...models.error import Error
from ...models.paginated_documents import PaginatedDocuments
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    limit: int | Unset = 20,
    cursor: str | Unset = UNSET,
    status: DocumentStatus | Unset = UNSET,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["limit"] = limit

    params["cursor"] = cursor

    json_status: str | Unset = UNSET
    if not isinstance(status, Unset):
        json_status = status.value

    params["status"] = json_status

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/documents",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | PaginatedDocuments | None:
    if response.status_code == 200:
        response_200 = PaginatedDocuments.from_dict(response.json())

        return response_200

    if response.status_code == 401:
        response_401 = Error.from_dict(response.json())

        return response_401

    if client.raise_on_unexpected_status:
        raise errors.UnexpectedStatus(response.status_code, response.content)
    else:
        return None


def _build_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Response[Error | PaginatedDocuments]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 20,
    cursor: str | Unset = UNSET,
    status: DocumentStatus | Unset = UNSET,
) -> Response[Error | PaginatedDocuments]:
    """List documents

     Returns a paginated list of documents in your organization. Use the `next_cursor` from the response
    to fetch the next page.

    Args:
        limit (int | Unset):  Default: 20.
        cursor (str | Unset):
        status (DocumentStatus | Unset): Current workflow status of a document

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | PaginatedDocuments]
    """

    kwargs = _get_kwargs(
        limit=limit,
        cursor=cursor,
        status=status,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 20,
    cursor: str | Unset = UNSET,
    status: DocumentStatus | Unset = UNSET,
) -> Error | PaginatedDocuments | None:
    """List documents

     Returns a paginated list of documents in your organization. Use the `next_cursor` from the response
    to fetch the next page.

    Args:
        limit (int | Unset):  Default: 20.
        cursor (str | Unset):
        status (DocumentStatus | Unset): Current workflow status of a document

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | PaginatedDocuments
    """

    return sync_detailed(
        client=client,
        limit=limit,
        cursor=cursor,
        status=status,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 20,
    cursor: str | Unset = UNSET,
    status: DocumentStatus | Unset = UNSET,
) -> Response[Error | PaginatedDocuments]:
    """List documents

     Returns a paginated list of documents in your organization. Use the `next_cursor` from the response
    to fetch the next page.

    Args:
        limit (int | Unset):  Default: 20.
        cursor (str | Unset):
        status (DocumentStatus | Unset): Current workflow status of a document

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | PaginatedDocuments]
    """

    kwargs = _get_kwargs(
        limit=limit,
        cursor=cursor,
        status=status,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    limit: int | Unset = 20,
    cursor: str | Unset = UNSET,
    status: DocumentStatus | Unset = UNSET,
) -> Error | PaginatedDocuments | None:
    """List documents

     Returns a paginated list of documents in your organization. Use the `next_cursor` from the response
    to fetch the next page.

    Args:
        limit (int | Unset):  Default: 20.
        cursor (str | Unset):
        status (DocumentStatus | Unset): Current workflow status of a document

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | PaginatedDocuments
    """

    return (
        await asyncio_detailed(
            client=client,
            limit=limit,
            cursor=cursor,
            status=status,
        )
    ).parsed

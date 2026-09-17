from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.list_signatures_response_200 import ListSignaturesResponse200
from ...types import UNSET, Response


def _get_kwargs(
    *,
    document_id: str,
) -> dict[str, Any]:

    params: dict[str, Any] = {}

    params["document_id"] = document_id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "get",
        "url": "/signatures",
        "params": params,
    }

    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | ListSignaturesResponse200 | None:
    if response.status_code == 200:
        response_200 = ListSignaturesResponse200.from_dict(response.json())

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
) -> Response[Error | ListSignaturesResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    document_id: str,
) -> Response[Error | ListSignaturesResponse200]:
    """List signatures

     Returns all signatures collected for a document.

    Args:
        document_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | ListSignaturesResponse200]
    """

    kwargs = _get_kwargs(
        document_id=document_id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    document_id: str,
) -> Error | ListSignaturesResponse200 | None:
    """List signatures

     Returns all signatures collected for a document.

    Args:
        document_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | ListSignaturesResponse200
    """

    return sync_detailed(
        client=client,
        document_id=document_id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    document_id: str,
) -> Response[Error | ListSignaturesResponse200]:
    """List signatures

     Returns all signatures collected for a document.

    Args:
        document_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | ListSignaturesResponse200]
    """

    kwargs = _get_kwargs(
        document_id=document_id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    document_id: str,
) -> Error | ListSignaturesResponse200 | None:
    """List signatures

     Returns all signatures collected for a document.

    Args:
        document_id (str):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | ListSignaturesResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            document_id=document_id,
        )
    ).parsed

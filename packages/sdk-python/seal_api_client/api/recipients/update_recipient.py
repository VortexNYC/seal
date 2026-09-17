from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.update_recipient_body import UpdateRecipientBody
from ...models.update_recipient_response_200 import UpdateRecipientResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: UpdateRecipientBody | Unset = UNSET,
    document_id: str,
    id: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    params["document_id"] = document_id

    params["id"] = id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "put",
        "url": "/recipients/update",
        "params": params,
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | UpdateRecipientResponse200 | None:
    if response.status_code == 200:
        response_200 = UpdateRecipientResponse200.from_dict(response.json())

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
) -> Response[Error | UpdateRecipientResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateRecipientBody | Unset = UNSET,
    document_id: str,
    id: str,
) -> Response[Error | UpdateRecipientResponse200]:
    """Update a recipient

     Updates a recipient on a draft document.

    Args:
        document_id (str):
        id (str):
        body (UpdateRecipientBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | UpdateRecipientResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
        document_id=document_id,
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateRecipientBody | Unset = UNSET,
    document_id: str,
    id: str,
) -> Error | UpdateRecipientResponse200 | None:
    """Update a recipient

     Updates a recipient on a draft document.

    Args:
        document_id (str):
        id (str):
        body (UpdateRecipientBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | UpdateRecipientResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
        document_id=document_id,
        id=id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateRecipientBody | Unset = UNSET,
    document_id: str,
    id: str,
) -> Response[Error | UpdateRecipientResponse200]:
    """Update a recipient

     Updates a recipient on a draft document.

    Args:
        document_id (str):
        id (str):
        body (UpdateRecipientBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | UpdateRecipientResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
        document_id=document_id,
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: UpdateRecipientBody | Unset = UNSET,
    document_id: str,
    id: str,
) -> Error | UpdateRecipientResponse200 | None:
    """Update a recipient

     Updates a recipient on a draft document.

    Args:
        document_id (str):
        id (str):
        body (UpdateRecipientBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | UpdateRecipientResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            document_id=document_id,
            id=id,
        )
    ).parsed

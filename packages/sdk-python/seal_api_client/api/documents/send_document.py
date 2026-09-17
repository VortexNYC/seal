from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.send_document_body import SendDocumentBody
from ...models.send_document_response_200 import SendDocumentResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: SendDocumentBody | Unset = UNSET,
    id: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    params["id"] = id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/documents/send",
        "params": params,
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | SendDocumentResponse200 | None:
    if response.status_code == 200:
        response_200 = SendDocumentResponse200.from_dict(response.json())

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
) -> Response[Error | SendDocumentResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SendDocumentBody | Unset = UNSET,
    id: str,
) -> Response[Error | SendDocumentResponse200]:
    """Send a document

     Sends the document to all recipients and transitions it from `draft` to `sent`. The document must
    have at least one recipient.

    Args:
        id (str):
        body (SendDocumentBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | SendDocumentResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
        id=id,
    )

    response = client.get_httpx_client().request(
        **kwargs,
    )

    return _build_response(client=client, response=response)


def sync(
    *,
    client: AuthenticatedClient | Client,
    body: SendDocumentBody | Unset = UNSET,
    id: str,
) -> Error | SendDocumentResponse200 | None:
    """Send a document

     Sends the document to all recipients and transitions it from `draft` to `sent`. The document must
    have at least one recipient.

    Args:
        id (str):
        body (SendDocumentBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | SendDocumentResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
        id=id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: SendDocumentBody | Unset = UNSET,
    id: str,
) -> Response[Error | SendDocumentResponse200]:
    """Send a document

     Sends the document to all recipients and transitions it from `draft` to `sent`. The document must
    have at least one recipient.

    Args:
        id (str):
        body (SendDocumentBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | SendDocumentResponse200]
    """

    kwargs = _get_kwargs(
        body=body,
        id=id,
    )

    response = await client.get_async_httpx_client().request(**kwargs)

    return _build_response(client=client, response=response)


async def asyncio(
    *,
    client: AuthenticatedClient | Client,
    body: SendDocumentBody | Unset = UNSET,
    id: str,
) -> Error | SendDocumentResponse200 | None:
    """Send a document

     Sends the document to all recipients and transitions it from `draft` to `sent`. The document must
    have at least one recipient.

    Args:
        id (str):
        body (SendDocumentBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | SendDocumentResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            id=id,
        )
    ).parsed

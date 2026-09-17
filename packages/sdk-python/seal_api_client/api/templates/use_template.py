from http import HTTPStatus
from typing import Any

import httpx

from ... import errors
from ...client import AuthenticatedClient, Client
from ...models.error import Error
from ...models.use_template_body import UseTemplateBody
from ...models.use_template_response_200 import UseTemplateResponse200
from ...types import UNSET, Response, Unset


def _get_kwargs(
    *,
    body: UseTemplateBody | Unset = UNSET,
    id: str,
) -> dict[str, Any]:
    headers: dict[str, Any] = {}

    params: dict[str, Any] = {}

    params["id"] = id

    params = {k: v for k, v in params.items() if v is not UNSET and v is not None}

    _kwargs: dict[str, Any] = {
        "method": "post",
        "url": "/templates/use",
        "params": params,
    }

    if not isinstance(body, Unset):
        _kwargs["json"] = body.to_dict()

    headers["Content-Type"] = "application/json"

    _kwargs["headers"] = headers
    return _kwargs


def _parse_response(
    *, client: AuthenticatedClient | Client, response: httpx.Response
) -> Error | UseTemplateResponse200 | None:
    if response.status_code == 200:
        response_200 = UseTemplateResponse200.from_dict(response.json())

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
) -> Response[Error | UseTemplateResponse200]:
    return Response(
        status_code=HTTPStatus(response.status_code),
        content=response.content,
        headers=response.headers,
        parsed=_parse_response(client=client, response=response),
    )


def sync_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UseTemplateBody | Unset = UNSET,
    id: str,
) -> Response[Error | UseTemplateResponse200]:
    """Create document from template

     Creates a new draft document pre-populated with the template's field layout. Add recipients and send
    when ready.

    Args:
        id (str):
        body (UseTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | UseTemplateResponse200]
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
    body: UseTemplateBody | Unset = UNSET,
    id: str,
) -> Error | UseTemplateResponse200 | None:
    """Create document from template

     Creates a new draft document pre-populated with the template's field layout. Add recipients and send
    when ready.

    Args:
        id (str):
        body (UseTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | UseTemplateResponse200
    """

    return sync_detailed(
        client=client,
        body=body,
        id=id,
    ).parsed


async def asyncio_detailed(
    *,
    client: AuthenticatedClient | Client,
    body: UseTemplateBody | Unset = UNSET,
    id: str,
) -> Response[Error | UseTemplateResponse200]:
    """Create document from template

     Creates a new draft document pre-populated with the template's field layout. Add recipients and send
    when ready.

    Args:
        id (str):
        body (UseTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Response[Error | UseTemplateResponse200]
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
    body: UseTemplateBody | Unset = UNSET,
    id: str,
) -> Error | UseTemplateResponse200 | None:
    """Create document from template

     Creates a new draft document pre-populated with the template's field layout. Add recipients and send
    when ready.

    Args:
        id (str):
        body (UseTemplateBody | Unset):

    Raises:
        errors.UnexpectedStatus: If the server returns an undocumented status code and Client.raise_on_unexpected_status is True.
        httpx.TimeoutException: If the request takes longer than Client.timeout.

    Returns:
        Error | UseTemplateResponse200
    """

    return (
        await asyncio_detailed(
            client=client,
            body=body,
            id=id,
        )
    ).parsed

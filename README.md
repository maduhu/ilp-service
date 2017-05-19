# ilp-service

This is an ILP sending and receiving client with a REST API.

## Installation

## Configuration

- DFSP ILP prefix
- ledger URL
- connectors (could also be passed in to queries)
- admin ledger creds
- secret (TODO: should this be generated?)
- backend URL

## API

### GET /quoteSourceAmount

#### Request

Query String Parameters:

| Parameter | Type | Description |
|---|---|---|
| destinationAddress | ILP Address | |
| sourceAmount | | |
| connectorAccount | URI | Optional - ledger account URI |

#### Response

JSON Fields:
| Parameter | Type | Description |
|---|---|---|
| destinationAmount | Integer | |
| connectorAccount | URI | ledger account URI |
| sourceExpiryDuration | Integer | Seconds |

### GET /quoteIpr

#### Request

| Parameter | Type | Description |
|---|---|---|
| ipr | Base64-URL String | |
| connectorAccount | URI | Optional - ledger account URI |

#### Response

| Parameter | Type | Description |
|---|---|---|
| sourceAmount | | |
| connectorAccount | URI | Optional - ledger account URI |
| sourceExpiryDuration | Integer | Seconds |

### POST /payments

#### Request


JSON Body Fields:

| Parameter | Type | Description |
|---|---|---|
| sourceAmount | | |
| sourceAccount | URI | |
| connectorAccount | URI | ledger account URI |
| ipr | Base64-URL String | |
| sourceExpiryDuration | Integer | Seconds |

**TODO:** Would you rather pass in the absolute ISO timestamp or the relative time in seconds?
**TODO:** Should this be idempotent with respect to the IPR or should there be a separate transfer ID?

#### Response

| Parameter | Type | Description |
|---|---|---|
| sourceAmount | | |
| connectorAccount | URI | ledger account URI |
| ipr | Base64-URL String | |
| uuid | | |
| status | String | `executed`, `rejected`, `expired` |
| rejectionMessage | JSON Object | Only present when status is `rejected` |
| fulfillment | Base64-URL String | Only present when status is `executed` |

### POST /createIpr

#### Request

| Parameter | Type | Description |
|---|---|---|
| uuid | UUID | |
| destinationAccount | URI | ledger URI |
| expiresAt | ISO Timestamp |

#### Response

JSON Fields:

| Parameter | Type | Description |
|---|---|---|
| ipr | Base64-URL String | |

**TODO:** Would you rather pass in the absolute ISO timestamp or the relative time in seconds?

### GET /ilpAddress

## Notifications

`ilp-service` is configured with

Which notification it is depends on the `status` field

POSTs to `<backend_url>`

| Parameter | Type | Description |
|---|---|---|
| ipr | Base64-URL String | |
| uuid | | |
| status | String | `prepared`, `executed`, `rejected`, `expired` |
| rejectionMessage | JSON Object | Only present when status is `rejected` |
| fulfillment | Base64-URL String | Only present when status is `executed` |


## Usage in an Application Layer Protocol

- getting ILP addresses for quotes
- making the IPR id the same as the one in the transfer
- converting ledger amounts to Integers


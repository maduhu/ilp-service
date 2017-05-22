# ilp-service
> An ILP sending and receiving client with a REST API.

The `ilp-service` is designed to be used to build Interledger payments and the [Interledger Payment Request (IPR)](https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md) transport protocol into Application Layer protocols. For more details on the Interledger protocol suite layers, see [IL-RFC 1: Interledger Architecture](https://github.com/interledger/rfcs/blob/master/0001-interledger-architecture/0001-interledger-architecture.md).

See [Notes for Application Layer Protocol Implementors](#notes-for-application-layer-protocol-implementors) for details on how this service should be used to build an end-to-end protocol for setting up payments.

The sending side will use the methods:

- [`GET  /quoteSourceAmount`](#get-quotesourceamount)
- [`GET  /quoteIPR`](#get-quoteipr)
- [`POST /payIPR`](#post-payipr)

The receiving side will use the methods:

- [`POST /createIPR`](#post-createipr)
- [`GET  /ilpAddress`](#get-ilpaddress)
- [Backend Notifications](#backend-notifications)

## Installation

**TODO**

## Configuration

The `ilp-service` is configured using environment variables.

| Environment Variable | Type | Description |
|---|---|---|
| `ILP_SERVICE_PORT` | Number | Port to run the ILP Service on. |
| `ILP_SERVICE_ILP_PREFIX` | ILP Address Prefix | ILP prefix for the DFSP. SHOULD start with `private.` |
| `ILP_SERVICE_LEDGER_ROOT` | URI | Base URI of the DFSP ledger. |
| `ILP_SERVICE_LEDGER_ADMIN_ACCOUNT` | URI | Admin ledger account URI. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_LEDGER_ADMIN_USERNAME` | String | Admin username. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_LEDGER_ADMIN_PASSWORD` | String | Admin password. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_CONNECTOR_ACCOUNT` | URI | Ledger account URI of the connector used to send Interledger payments. |
| `ILP_SERVICE_BACKEND` | URI | Backend server to send notifications to. See [Backend Notifications](#backend-notifications). |

**TODO:** Should the `ilp-service` be configured with a secret to use for condition generation or should it generate one?

## API

### GET /quoteSourceAmount

Get a fixed source amount quote.

#### Request Query String Parameters

| Parameter | Type | Description |
|---|---|---|
| `destinationAddress` | ILP Address | ILP Address for the destination. **Note: This must be communicated in the Application Layer protocol to enable the sender to request quotes with fixed source amounts.** |
| `sourceAmount` | Decimal String | Amount the source account will send to the connector, denominated in the currency of the source ledger |
| `connectorAccount` | URI | **Optional.** Ledger account URI of a connector to send the quote request to. If one is not provided, the connector(s) provided in the `ilp-service` configuration will be used. |
| `destinationScale` | Integer | Scale of the amounts on the destination ledger, which can be found in the ledger's metadata. Used to format the `destinationAmount` in the return value. **Note: This must be communicated in the Application Layer protocol. If this value is incorrect, the result will be off by several orders of magnitude** |

#### JSON Response

| Parameter | Type | Description |
|---|---|---|
| `destinationAmount` | Decimal String | Amount the `destinationAddress` will receive, denominated in the currency of the destination ledger. |
| `connectorAccount` | URI | Ledger account URI of the connector through which this payment can be sent. |
| `sourceExpiryDuration` | Integer | Number of seconds after the payment is submitted that the outgoing transfer will expire. |

### GET /quoteIPR

Get a quote for an [Interledger Payment Request (IPR)](https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md) communicated from a receiver.

#### Request Query String Parameters

| Parameter | Type | Description |
|---|---|---|
| `ipr` | Base64-URL String | Binary IPR from the receiver. |
| `connectorAccount` | URI | **Optional.** Ledger account URI of a connector to send the quote request to. If one is not provided, the connector(s) provided in the `ilp-service` configuration will be used. |

#### JSON Response

| Parameter | Type | Description |
|---|---|---|
| `sourceAmount` | Decimal String | Amount the source amount should send to the connector, denominated in the currency of the source ledger. |
| `connectorAccount` | URI | Ledger account URI of the connector through which this payment can be sent. |
| `sourceExpiryDuration` | Integer | Number of seconds after the payment is submitted that the outgoing transfer will expire. |

### POST /payIPR

Execute an Interledger payment through a connector.

This method is idempotent. Submitting the same IPR multiple times will not cause the transfer to be executed multiple times. **Note: Ledgers MUST ensure that transfer IDs are unique, otherwise this guarantee does not hold.**

#### JSON Request Body

| Parameter | Type | Description |
|---|---|---|
| `ipr` | Base64-URL String | Binary IPR from the receiver. |
| `sourceAmount` | Decimal String | Amount the source account should send to the connector, denominated in the currency of the source ledger. |
| `sourceAccount` | URI | Ledger account URI to send the transfer from. |
| `connectorAccount` | URI | Ledger account URI of the connector through which this payment will be sent. |
| `sourceExpiryDuration` | Integer | Number of seconds after the payment is submitted that the outgoing transfer will expire. |

**TODO:** Would you rather pass in the absolute ISO timestamp or the relative time in seconds?
**TODO:** Should this be idempotent with respect to the IPR or should there be a separate transfer ID?

#### JSON Response

| Parameter | Type | Description |
|---|---|---|
| `paymentId` | UUID | The UUID of the local transfer and the Interledger payment (generated by the receiver and included in the IPR). |
| `connectorAccount` | URI | Ledger account URI of the connector through which this payment was sent. |
| `status` | String | `executed`, `rejected`, `expired` |
| `rejectionMessage` | JSON Object | Only present when status is `rejected` |
| `fulfillment` | Base64-URL String | Only present when status is `executed` |

### POST /createIPR

Create an [Interledger Payment Request (IPR)](https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md). The IPR should be communicated from a receiver to a sender using an Application Layer protocol to request a payment from the sender.

Once an IPR has been created, the `ilp-service` will listen for incoming prepared transfers. The `ilp-service` sends notifications to the backend to determine if an incoming payment should be accepted.

#### JSON Request Body

| Parameter | Type | Description |
|---|---|---|
| `paymentId` | UUID | Unique ID of this payment request. This will be included in the notifications about incoming transfers and should be used to correlate IPRs communicated to senders with incoming payments. |
| `destinationAccount` | URI | Ledger account URI of the account into which the funds will be paid. |
| `destinationAmount` | Decimal String | The requested amount, which will be paid into the `destinationAccount`. |
| `expiresAt` | ISO Timestamp | Expiration of the payment request. Incoming transfers received after this time will be automatically rejected. |

**TODO:** Would you rather pass in the absolute ISO timestamp or the relative time in seconds?

#### JSON Response Body

JSON Fields:

| Parameter | Type | Description |
|---|---|---|
| `ipr` | Base64-URL String | Binary IPR that should be communicated to the sender over an Application Layer protocol. |

### GET /ilpAddress

Get the ILP Address for a given ledger account. **Note: This should be included in Application Layer protocols so that senders can request fixed source amount quotes to the receiver.**

#### Request Query String Parameters

| Parameter | Type | Description |
|---|---|---|
| `account` | URI | Ledger account URI. |

#### JSON Response Body

| Parameter | Type | Description |
|---|---|---|
| `ilpAddress` | ILP Address | The ILP Address corresponding to the account provided. This is used primarily for quoting by source amount. |

## Backend Notifications

### POST <ILP_SERVICE_BACKEND>/notifications

The `ilp-service` sends notifications of incoming transfers to the configured backend service.

When a transfer is `prepared`, the `ilp-service` will send the notification and **it will only fulfill the transfer if the backend responds with an HTTP 200. Any other response will cause the transfer to be rejected with the error message returned.**

#### JSON Request Body

| Parameter | Type | Description |
|---|---|---|
| `ipr` | Base64-URL String | The IPR being paid by this transfer. |
| `paymentId` | UUID | Unique ID of the payment request. This is the same value that was submitted when the IPR was created. |
| `destinationAccount` | URI | Ledger account URI of the account into which the funds will be paid if the transfer is executed. |
| `status` | One of: `prepared`, `executed` | The status of the payment. See below for more details. |
| `fulfillment` | Base64-URL String | **Only present when status is `executed`.** This is the proof used to execute the incoming transfer. |

##### Transfer Status Descriptions

| Status | Description |
|---|---|
| `prepared` | Funds are on hold and the `ilp-service` is awaiting approval from the backend before fulfilling the transfer condition. The transfer will only be fulfilled if the backend responds to this notification with an HTTP 200 status code. |
| `executed` | The incoming transfer has been executed and the `destinationAccount` has been paid. The `fulfillment` field will contain the proof used to execute the incoming transfer. |

## Notes for Application Layer Protocol Implementors

The `ilp-service` is designed to be used to build Interledger payments and the Interledger Payment Request (IPR) Transport Layer protocol into Application Layer protocols. This section includes some notes and considerations for implementors of Application Layer protocols using this service.

### ILP Addresses

The Interledger Protocol uses [ILP Addresses](https://github.com/interledger/rfcs/blob/master/0015-ilp-addresses/0015-ilp-addresses.md) to identify ledgers and accounts in a scheme-agnostic manner.

Most of the use of ILP Addresses is handled by the `ilp-service`, with one exception. Application Layer protocol implementors SHOULD include a way for a sender to get the ILP address of a receiver to enable [quoting with a fixed source amount](#get-quotesourceamount). The receiver can use the `ilp-service` to [get the ILP adddress for a given ledger account](#get-ilpaddress).

### Interledger Payment Requests (IPRs)

The Interledger Payment Request (IPR) includes a fixed destination amount, the destination ILP address, and payment condition. Implementors of Application Layer protocols MUST include a way for the receiver to communicate the IPR to the sender.

### Complex Fees

The IPR includes a fixed destination amount. The sender will get a quote from one or more connectors to determine the cost of delivering the specified amount to the receiver.

If receiving DFSPs wish to implement additional fees, those can be included in the Application Layer protocol communication and deducted from the end recipient's account once transfers are executed.

If sending DFSPs which to implement additional fees, those can be added to the chosen source amount or the source amount determined by quoting an IPR. The fee amount can be deducted from the sender's account when the outgoing transfer is executed.


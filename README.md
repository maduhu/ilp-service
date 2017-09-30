# ilp-service
> An Interledge Protocol (ILP) sending and receiving client with a RESTful(ish) API.

The `ilp-service` is designed to be used to build Interledger-capable systems on top of the [Interledger Payment Request (IPR)][] transport protocol. For more details on the Interledger protocol suite layers, see [IL-RFC 1: Interledger Architecture][].

[Interledger Payment Request (IPR)]: https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md
[IL-RFC 1: Interledger Architecture]: https://github.com/interledger/rfcs/blob/master/0001-interledger-architecture/0001-interledger-architecture.md

Contents:

- [Deployment](#deployment)
- [Configuration](#configuration)
- [API](#api)
- [Logging](#logging)
- [Tests](#tests)
- [Notes for Application Layer Protocol Implementors](#notes-for-application-layer-protocol-implementors)


## Deployment

You can deploy the `ilp-service` with the [ILP Ansible Playbook][].

[ILP Ansible Playbook]: https://github.com/LevelOneProject/Docs/blob/master/ILP/ansible/ansible.yml

## Configuration

The `ilp-service` is configured using environment variables. For deployment, [ILP Ansible Playbook][] sets the values of these variables.

| Environment Variable                | Type               | Description       |
|:------------------------------------|:-------------------|:------------------|
| `ILP_SERVICE_PORT`                  | Number             | Port to run the ILP Service on. |
| `ILP_SERVICE_ILP_PREFIX`            | ILP Address Prefix | ILP address prefix for the DFSP. This should start with `private.` |
| `ILP_SERVICE_LEDGER_ADMIN_ACCOUNT`  | [URI][]            | Admin ledger account URI. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_LEDGER_ADMIN_USERNAME` | String             | Admin username. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_LEDGER_ADMIN_PASSWORD` | String             | Admin password. Used to enable the `ilp-service` to send quote requests and transfers on behalf of DFSP account holders. |
| `ILP_SERVICE_CONNECTOR_ACCOUNT`     | [URI][]            | Ledger account URI of the connector used to send Interledger payments. |
| `ILP_SERVICE_BACKEND`               | [URI][]            | Backend server to send notifications to. See [Backend Notifications](#backend-notifications). |
| `ILP_SERVICE_SECRET`                | String             | _(Optional)_ Secret value used to create and verify IPRs as the receiver. If omitted, generates a random value on startup. |
| `ILP_SERVICE_CENTRAL_CONNECTOR_ACCOUNT`  | [URI][]       | Account URI of the connector on the ledger one hop before the ledger that the admin is on (the IST or Central Ledger). |
| `ILP_SERVICE_CENTRAL_CONNECTOR_PASSWORD` | String        | Account password of the connector on the ledger one hop before the ledger that the admin is on (the IST or Central Ledger). |

### Ledger URIs
[URI]: #ledger-uris

A "Ledger account URI" is the HTTPS URL of an account in the [ILP Ledger Adapter API][].

[ILP Ledger Adapter API]: https://github.com/LevelOneProject/Docs/blob/master/ILP/ledger-adapter.md

## API

The sending side uses the following methods:

- [`GET  /quoteSourceAmount`](#get-quotesourceamount)
- [`GET  /quoteIPR`](#get-quoteipr)
- [`POST /payIPR`](#post-payipr)

The receiving side uses the following methods:

- [`POST /createIPR`](#post-createipr)
- [`GET  /ilpAddress`](#get-ilpaddress)
- [Backend Notifications](#backend-notifications)

### GET /quoteSourceAmount

Get a fixed source amount quote.

#### quoteSourceAmount Request

```
GET /quoteSourceAmount
```

The request must include the following query string parameters:

| Parameter            | Type           | Description                          |
|:---------------------|:---------------|:-------------------------------------|
| `destinationAddress` | ILP Address    | ILP Address for the destination.<br/>**Note:** This must be communicated in the Application Layer protocol to enable the sender to request quotes with fixed source amounts.|
| `sourceAmount`       | Decimal String | Amount the source account would send to the connector, denominated in the currency of the source ledger. |
| `destinationScale`   | Integer        | Scale of the amounts on the destination ledger. Used to format the `destinationAmount` in the return value. This SHOULD be reported by the ledger, for example in a [Get Metdata Method](https://github.com/LevelOneProject/Docs/blob/master/ILP/ledger-adapter.md#get-server-metadata)<br/>**Note:** This must be communicated in the Application Layer protocol. If this value is incorrect, the result will be off by several orders of magnitude. |
| `connectorAccount`   | [URI][]        | _(Optional)_ Ledger account URI of a connector to send the quote request to. If omitted, `ilp-service` uses the connector(s) defined in its config. |

#### quoteSourceAmount Response

A successful response uses the HTTP status code **200 OK**. The message body is a JSON object with the following fields:

| Parameter              | Type           | Description                        |
|:-----------------------|:---------------|:-----------------------------------|
| `destinationAmount`    | Decimal String | Amount the `destinationAddress` will receive, denominated in the currency of the destination ledger. |
| `connectorAccount`     | [URI][]        | Ledger account URI of the connector through which this payment can be sent. |
| `sourceExpiryDuration` | Integer        | Number of seconds after the payment is submitted that the outgoing transfer will expire. |


### GET /quoteIPR

Get a quote for an [Interledger Payment Request (IPR)](https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md) communicated from a receiver.

#### quoteIPR Request

```
GET /quoteIPR
```

The request must include the following query string parameters:

| Parameter          | Type              | Description                         |
|:-------------------|:------------------|:------------------------------------|
| `ipr`              | Base64-URL String | Binary IPR from the receiver.       |
| `connectorAccount` | [URI][]           | _(Optional)_ Ledger account URI of a connector to send the quote request to. If omitted, `ilp-service` uses the connector(s) defined in its config. |

#### quoteIPR Response

A successful response uses the HTTP status code **200 OK**. The message body is a JSON object with the following fields:

| Parameter              | Type           | Description                        |
|:-----------------------|:---------------|:-----------------------------------|
| `sourceAmount`         | Decimal String | Amount the source amount should send to the connector, denominated in the currency of the source ledger. |
| `connectorAccount`     | [URI][]        | Ledger account URI of the connector through which this payment can be sent. |
| `sourceExpiryDuration` | Integer        | Number of seconds after the payment is submitted that the outgoing transfer expires. |



### POST /payIPR

Execute an Interledger payment through a connector.

This method is idempotent. Submitting the same IPR multiple times does not cause the transfer to be executed multiple times. However, you cannot use this method to retry paying for the same IPR.

**Note:** This method prepares the transfer in the ledger using the unique `paymentID` embedded in the binary `ipr` of this request as the ID of the transfer. The ledger MUST ensure that the specified transfer ID is unique, or the guarantee that this transfer is idempotent does not hold.

#### payIPR Request

```
POST /payIPR
```

The request's message body is a JSON object with the following fields:

| Parameter              | Type              | Description                     |
|:-----------------------|:------------------|:--------------------------------|
| `ipr`                  | Base64-URL String | Binary IPR from the receiver.   |
| `sourceAmount`         | Decimal String    | Amount the source account should send to the connector, denominated in the currency of the source ledger. |
| `sourceAccount`        | [URI][]           | Ledger account URI to send the transfer from. |
| `connectorAccount`     | [URI][]           | Ledger account URI of the connector through which this payment will be sent. |
| `sourceExpiryDuration` | Integer           | Number of seconds after the payment is submitted that the outgoing transfer will expire. |

#### payIPR Response

A successful response uses the HTTP status code **200 OK**. The message body is a JSON object with the following fields:

| Parameter          | Type              | Description                         |
|:-------------------|:------------------|:------------------------------------|
| `paymentId`        | UUID              | The UUID of the local transfer and the Interledger payment (generated by the receiver and included in the IPR). |
| `connectorAccount` | [URI][]           | Ledger account URI of the connector through which this payment was sent. |
| `status`           | String            | `executed`, `rejected`, `expired`   |
| `rejectionMessage` | JSON Object       | Only present when status is `rejected`. This SHOULD be an object in the [ILP Error Format][]. |
| `fulfillment`      | Base64-URL String | Only present when status is `executed` |

[ILP Error Format]: https://github.com/interledger/rfcs/blob/master/0003-interledger-protocol/0003-interledger-protocol.md#ilp-error-format


### POST /createIPR

Create an [Interledger Payment Request (IPR)](https://github.com/interledger/rfcs/blob/master/0011-interledger-payment-request/0011-interledger-payment-request.md). The IPR should be communicated from a receiver to a sender using an Application Layer protocol to request a payment from the sender.

Once an IPR has been created, the `ilp-service` will listen for incoming prepared transfers. The `ilp-service` sends notifications to the backend to determine if an incoming payment should be accepted.

#### createIPR Request

```
POST /createIPR
```

The request includes the following query string parameters:

| Parameter            | Type           | Description                          |
|:---------------------|:---------------|:-------------------------------------|
| `paymentId`          | UUID           | Unique ID of this payment request. This will be included in the notifications about incoming transfers and should be used to correlate IPRs communicated to senders with incoming payments. |
| `destinationAccount` | [URI][]        | Ledger account URI of the account into which the funds will be paid. |
| `destinationAmount`  | Decimal String | The requested amount, which will be paid into the `destinationAccount`. |
| `expiresAt`          | ISO Timestamp  | Expiration of the payment request. Incoming transfers received after this time will be automatically rejected. |
| `data`               | Object         | (Optional) Arbitrary JSON data to attach to the IPR. |

**TODO:** Would you rather pass in the absolute ISO timestamp or the relative time in seconds?

#### createIPR Response

A successful response uses the HTTP status code **200 OK**. The message body is a JSON object with the following fields:

| Parameter | Type              | Description                                  |
|:----------|:------------------|:---------------------------------------------|
| `ipr`     | Base64-URL String | Binary IPR that should be communicated to the sender over an Application Layer protocol. |



### GET /ilpAddress

Get the ILP Address for a given ledger account. **Note: This should be included in Application Layer protocols so that senders can request fixed source amount quotes to the receiver.**

#### ilpAddress Request

```
GET /ilpAddress
```

The request includes the following query-string parameters:

| Parameter | Type       | Description         |
|:----------|:-----------|:--------------------|
| `account` | [URI][]    | Ledger account URI. |

#### ilpAddress Response

A successful response uses the HTTP status code **200 OK**. The message body is a JSON object with the following fields:

| Parameter    | Type               | Description                              |
|:-------------|:-------------------|:-----------------------------------------|
| `ilpAddress` | ILP Address String | The ILP Address corresponding to the account provided. This is used primarily for quoting by source amount. |



## Backend Notifications

When a transfer is prepared, the `ilp-service` send a notification callback in the form of outgoing HTTP requests. A client of the `ilp-service` must run a service that accepts HTTP requests in the notification format and processes them accordingly. Most importantly, the response to these notification requests MUST use the HTTP status code **200 OK** to indicate success. If the response uses any other status code, the `ilp-service` rejects the transfer using the response's message body as the rejection reason.

### Notification Request

When a transfer is `prepared`, the `ilp-service` sends a notification to the configured backend service at the URL specified in the `ILP_SERVICE_BACKEND` configuration option.

```
POST <ILP_SERVICE_BACKEND>/notifications
```

#### Notification Request Body

The message body of the Notification request is a JSON Object with the following fields:

| Parameter            | Type                                   | Description  |
|:---------------------|:---------------------------------------|:-------------|
| `ipr`                | Base64-URL String                      | The IPR being paid by this transfer. |
| `paymentId`          | UUID String                            | Unique ID of the payment request. This is the same value that was submitted when the IPR was created. |
| `destinationAccount` | [URI][]                                | Ledger account URI of the account into which the funds will be paid if the transfer is executed. |
| `status`             | String. One of: `prepared`, `executed` | The status of the payment. See below for more details. |
| `fulfillment`        | Base64-URL String                      | This is the cryptographic fulfillment used to execute the incoming transfer. <br/>(Only present when status is `executed`.) |
| `data`               | Object                                 | Arbitrary JSON data attached to the IPR. <br/>(Only present when `data` was passed into the corresponding createIPR call)  |

##### Transfer Status Descriptions

The `status` field of the payment is one of the following values:

| Status     | Description                                                     |
|:-----------|:----------------------------------------------------------------|
| `prepared` | Funds are on hold and the `ilp-service` is awaiting approval from the backend before fulfilling the transfer condition. The transfer will only be fulfilled if the backend responds to this notification with the HTTP status code **200 OK**. |
| `executed` | The incoming transfer has been executed and the `destinationAccount` has been paid. The transfer has a `fulfillment` field, which contains the cryptographic fulfillment used to execute the incoming transfer. |

### Notification Response

If the notification is processed successfully, the response MUST use the HTTP Status Code **200 OK**. The `ilp-service` ignores the headers and message body of this response.

If there is a problem, the response SHOULD have the following attributes:

| Attribute             | Value                                                |
|:----------------------|:-----------------------------------------------------|
| HTTP status code      | Any valid [HTTP Status Code](https://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html) in the range **400-599** (inclusive)             |
| `Content-Type` Header | `application/json`                                   |
| Message body          | JSON object describing the nature of the problem. The `ilp-service` uses this value as the rejection reason of the transfer. This SHOULD be an object in the [ILP Error Format][]. |



## Logging

***TODO: What gets logged and where (forensic & generic logs)***


## Tests

Running the tests:

    npm run test

Tests include code coverage via [istanbul](https://www.npmjs.com/package/istanbul) and unit tests via [mocha](https://www.npmjs.com/package/mocha). See the [**test/**](test/) folder for testing scripts.


## Notes for Application Layer Protocol Implementors

The `ilp-service` is designed to be used to build Interledger payments and the Interledger Payment Request (IPR) Transport Layer protocol into Application Layer protocols. This section includes some notes and considerations for implementors of Application Layer protocols using this service.

### ILP Addresses

The Interledger Protocol uses [ILP Addresses](https://github.com/interledger/rfcs/blob/master/0015-ilp-addresses/0015-ilp-addresses.md) to identify ledgers and accounts in a scheme-agnostic manner.

Most of the use of ILP Addresses is handled by the `ilp-service`, with one exception. Application Layer protocol implementors SHOULD include a way for a sender to get the ILP address of a receiver to enable [quoting with a fixed source amount](#get-quotesourceamount). The receiver can use the `ilp-service` to [get the ILP adddress for a given ledger account](#get-ilpaddress).

### Interledger Payment Requests (IPRs)

The Interledger Payment Request (IPR) includes a fixed destination amount, the destination ILP address, and payment condition. Implementors of Application Layer protocols MUST include a way for the receiver to communicate the IPR to the sender.

### Complex Fees

The IPR includes a fixed destination amount. The sender will get a quote from one or more connectors to determine the cost of delivering the specified amount to the receiver.

If receiving DFSPs want to implement additional fees, those can be included in the Application Layer protocol communication and deducted from the end recipient's account after transfers are executed.

If sending DFSPs want to implement additional fees, those can be added to the chosen source amount or the source amount determined by quoting an IPR. The fee amount can be deducted from the sender's account when the outgoing transfer is executed.

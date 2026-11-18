# Reminder module

SMS reminders are submitted to the configured Webpostservice gateway and logged after the gateway accepts them. WhatsApp is not configured and is returned as a per-student failure. Gateway acceptance does not guarantee handset delivery.

Base URL: `https://fee-management-icmrt.vercel.app`

On the deployment today, `GET /api/reminders` and `GET /api/reminders?unpaid=true` return `{"success":true,"data":[]}`. `POST /api/reminders` with an empty body returns `400` `VALIDATION_ERROR` (`studentIds`, `channels`, and `actedBy` are required).

## Success

### Send SMS reminders

`POST /api/reminders`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"studentIds":[2],"channels":["SMS"],"actedBy":"fee-admin","message":"Your fee balance is due. Please contact the accounts office."}'
```

Status: `201`

```json
{"success":true,"data":{"sent":[{"studentId":2,"channel":"SMS","reminderId":1}],"failed":[]}}
```

The gateway request uses `apikey`, `senderid`, `type`, `mobile`, and `message`
query parameters. Provider settings are read from `SMS_API_URL`, `SMS_API_KEY`,
`SMS_SENDER_ID`, and `SMS_TYPE` in the backend environment. The API key is
never returned in responses or logged by this module.

### List students reminded and still unpaid

`GET /api/reminders?unpaid=true`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/reminders?unpaid=true
```

Status: `200`

```json
{"success":true,"data":[{"studentId":2,"registrationNumber":"REG-LATE","name":"Bharat Singh","duesOutstanding":9850,"reminders":[{"id":1,"channel":"SMS","sentAt":"2026-11-11T10:12:47.542Z","actedBy":"fee-admin"}]}]}
```

## Wrong entry

### Remind a student with no dues

`POST /api/reminders`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"studentIds":[1],"channels":["SMS"],"actedBy":"fee-admin"}'
```

Status: `400`

```json
{"success":false,"error":"NO_OUTSTANDING_DUES","details":[{"path":"studentIds","message":"student 1 has no outstanding dues"}]}
```

### Empty channel list

`POST /api/reminders`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"studentIds":[2],"channels":[],"actedBy":"fee-admin"}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"channels","message":"at least one channel is required"}]}
```

## Other failure

### Unknown student

`POST /api/reminders`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/reminders \
  -H "Content-Type: application/json" \
  -d '{"studentIds":[999999],"channels":["SMS"],"actedBy":"fee-admin"}'
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```

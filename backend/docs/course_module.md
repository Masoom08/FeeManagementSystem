# Course module

Base URL: `https://fee-management-icmrt.vercel.app`

Checked against that deployment on 11 Nov 2026. The `/api/...` routes respond with JSON. `GET /` on the deployment that is live right now is still the previous build: `404` HTML `Cannot GET /`. The index route is on `main` and returns the JSON in the service-root section once Vercel publishes that commit.

The success, wrong-entry, and other-failure cases below are one complete example run, in order. They are not the rows currently stored on the deployment. The deployment database has course `AKTU01` only.

`GET /api/courses` on the deployment:

```json
{"success":true,"data":[{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU)","affiliation":"AKTU","lateFeePerDay":15,"active":true}]}
```

`GET /api/courses/1` returns that same course object. `POST` of `AKTU01` again returns `409` `{"success":false,"error":"DUPLICATE_COURSE_CODE"}`. `GET /api/courses/999999` returns `404` `{"success":false,"error":"NOT_FOUND"}`. `GET /api/courses/abc` returns `400` `VALIDATION_ERROR` with `id must be a positive integer`. Invalid JSON returns `400` `{"success":false,"error":"INVALID_JSON"}`.

### Service root

`GET /`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/
```

Status on the deployment checked on 11 Nov 2026: `404`

```html
Cannot GET /
```

The latest `main` adds this route. After Vercel publishes that commit the same URL returns `200`:

```json
{"success":true,"data":{"name":"ICCMRT Fee Management API","endpoints":["/api/courses","/api/academic-years","/api/semesters","/api/fee-structures","/api/fees","/api/students","/api/payments","/api/receipts","/api/reminders","/api/reports"]}}
```

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/courses` | Create a course |
| GET | `/api/courses` | List courses |
| GET | `/api/courses/:id` | Get one course |
| PATCH | `/api/courses/:id` | Update a course, including `active: false` |

There is no delete. A course is turned off with `active: false`.

Success body: `{ "success": true, "data": ... }`

Failure body: `{ "success": false, "error": "...", "details": [...] }` when validation fails. `details` is omitted for duplicate, not found, and invalid JSON.

## Success

### Create MBA (AKTU)

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"AKTU01","courseName":"MBA (AKTU)","affiliation":"AKTU","lateFeePerDay":15}'
```

Status: `201`

```json
{"success":true,"data":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU)","affiliation":"AKTU","lateFeePerDay":15,"active":true}}
```

### Create a second course

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"AKTU02","courseName":"BBA (AKTU)","affiliation":"AKTU","lateFeePerDay":5}'
```

Status: `201`

```json
{"success":true,"data":{"id":2,"courseCode":"AKTU02","courseName":"BBA (AKTU)","affiliation":"AKTU","lateFeePerDay":5,"active":true}}
```

### List courses

`GET /api/courses`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/courses
```

Status: `200`

```json
{"success":true,"data":[{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU)","affiliation":"AKTU","lateFeePerDay":15,"active":true},{"id":2,"courseCode":"AKTU02","courseName":"BBA (AKTU)","affiliation":"AKTU","lateFeePerDay":5,"active":true}]}
```

### Get by id

`GET /api/courses/1`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/courses/1
```

Status: `200`

```json
{"success":true,"data":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU)","affiliation":"AKTU","lateFeePerDay":15,"active":true}}
```

### Update the name

`PATCH /api/courses/1`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/courses/1 \
  -H "Content-Type: application/json" \
  -d '{"courseName":"MBA (AKTU) Updated"}'
```

Status: `200`

```json
{"success":true,"data":{"id":1,"courseCode":"AKTU01","courseName":"MBA (AKTU) Updated","affiliation":"AKTU","lateFeePerDay":15,"active":true}}
```

### Deactivate a course

`PATCH /api/courses/2`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/courses/2 \
  -H "Content-Type: application/json" \
  -d '{"active":false}'
```

Status: `200`

```json
{"success":true,"data":{"id":2,"courseCode":"AKTU02","courseName":"BBA (AKTU)","affiliation":"AKTU","lateFeePerDay":5,"active":false}}
```

### Read the deactivated course

`GET /api/courses/2`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/courses/2
```

Status: `200`

```json
{"success":true,"data":{"id":2,"courseCode":"AKTU02","courseName":"BBA (AKTU)","affiliation":"AKTU","lateFeePerDay":5,"active":false}}
```

## Wrong entry

### Missing courseCode

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":5}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"courseCode","message":"courseCode is required"}]}
```

### Missing courseName

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","affiliation":"LU","lateFeePerDay":5}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"courseName","message":"courseName is required"}]}
```

### Affiliation other than AKTU or LU

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","courseName":"BBA (LU)","affiliation":"CBSE","lateFeePerDay":5}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"affiliation","message":"affiliation must be AKTU or LU"}]}
```

### lateFeePerDay of 0

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":0}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"lateFeePerDay","message":"lateFeePerDay must be a positive integer"}]}
```

### Negative lateFeePerDay

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":-5}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"lateFeePerDay","message":"lateFeePerDay must be a positive integer"}]}
```

### lateFeePerDay sent as a string

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":"5"}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"lateFeePerDay","message":"lateFeePerDay must be an integer"}]}
```

### Empty courseCode

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"","courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":5}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"courseCode","message":"courseCode is required"}]}
```

### Unknown field

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"LU01","courseName":"BBA (LU)","affiliation":"LU","lateFeePerDay":5,"department":"Management"}'
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"body","message":"Unrecognized key(s) in object: 'department'"}]}
```

### Non-numeric id

`GET /api/courses/abc`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/courses/abc
```

Status: `400`

```json
{"success":false,"error":"VALIDATION_ERROR","details":[{"path":"id","message":"id must be a positive integer"}]}
```

## Other failure

### Duplicate courseCode

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":"AKTU01","courseName":"MBA duplicate","affiliation":"AKTU","lateFeePerDay":15}'
```

Status: `409`

```json
{"success":false,"error":"DUPLICATE_COURSE_CODE"}
```

### Get an id that does not exist

`GET /api/courses/999999`

```bash
curl -X GET https://fee-management-icmrt.vercel.app/api/courses/999999
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```

### Patch an id that does not exist

`PATCH /api/courses/999999`

```bash
curl -X PATCH https://fee-management-icmrt.vercel.app/api/courses/999999 \
  -H "Content-Type: application/json" \
  -d '{"courseName":"Missing"}'
```

Status: `404`

```json
{"success":false,"error":"NOT_FOUND"}
```

### Invalid JSON body

`POST /api/courses`

```bash
curl -X POST https://fee-management-icmrt.vercel.app/api/courses \
  -H "Content-Type: application/json" \
  -d '{"courseCode":'
```

Status: `400`

```json
{"success":false,"error":"INVALID_JSON"}
```

## Data on the deployment

- Course `1`: `AKTU01`, name `MBA (AKTU)`, active.
- Academic year `1`: `2026-27`.
- No semesters, fee structures, students, payments, or reminders.

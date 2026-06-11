# Security Test Specification (`security_spec.md`)

## 1. Data Invariants

Our resume system enforces the following cryptographic and relational invariants:
- **Identity Isolation**: A user's profile metadata in `/users/{userId}` is strictly private. Only the authenticated user matching `userId` can read or write to it.
- **Data Ownership**: A user's resumes in `/resumes/{resumeId}` belong strictly to them. Read, update, and delete actions are constrained to authenticated owners (`resource.data.userId == request.auth.uid`).
- **Owner Immutability**: The `userId` of a resume cannot be modified or re-assigned once created.
- **Temporal Integrity**: Creation timestamps (`createdAt`) are immutable after initial insertion, and update timestamps (`updatedAt`) must always be verified against the secure server clock (`request.time`).
- **Key Whitelisting**: Partial updates to resume documents are strictly action-filtered, preventing ghost fields or privilege injection.
- **String and Storage Guarding**: Field boundaries (length and array sizes) are strictly checked to shield against resources exhaustion.

---

## 2. The "Dirty Dozen" Malicious Exploits

Below are twelve payloads designed to bypass client-side gates. These must all fail with `PERMISSION_DENIED` under our security rules.

### Exploit 1: User Profile Swapping (Identity Spoofing)
An authenticated attacker (`uid: attacker_123`) tries to create or update a user profile document for a victim.
- **Path**: `/users/victim_999`
- **Payload**:
  ```json
  {
    "userId": "victim_999",
    "email": "victim@example.com",
    "name": "Victim User"
  }
  ```

### Exploit 2: Anonymous User Registration (Anonymous Lockout Bypass)
An unauthenticated or unverified client attempts to register a profile in `/users`.
- **Path**: `/users/anonymous_user`
- **Payload**:
  ```json
  {
    "userId": "anonymous_user",
    "email": "exploit@example.com",
    "name": "Anonymous Guest"
  }
  ```

### Exploit 3: Admin Spoofing / Self-Elevated Privilege Escalation
A user tries to insert a privilege level or roles inside their own user profile document.
- **Path**: `/users/attacker_123`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "email": "attacker@example.com",
    "name": "Attacker",
    "role": "admin",
    "isAdmin": true
  }
  ```

### Exploit 4: Profile Injection of Arbitrary Fields (Ghost Invariant Leak)
An attacker injects non-standard keys to see if the user collection accepts arbitrary field pollution.
- **Path**: `/users/attacker_123`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "email": "attacker@example.com",
    "name": "Attacker",
    "superSecretToken": "malicious_content_payload",
    "bannedFromApp": false
  }
  ```

### Exploit 5: Resume Theft (External User Identity Hijacking)
An attacker (`uid: attacker_123`) tries to create a resume document for a different user (`userId: victim_999`).
- **Path**: `/resumes/malicious_resume_01`
- **Payload**:
  ```json
  {
    "userId": "victim_999",
    "title": "Attacker Hijack",
    "resumeData": {},
    "templateId": "modern"
  }
  ```

### Exploit 6: Unauthorized Resume Reading (Blanket Read Bypass)
An authenticated attacker (`uid: attacker_123`) attempts to execute a `get` action on another user's private resume document `/resumes/victim_resume_101`.
- **Method**: GET
- **Target Path**: `/resumes/victim_resume_101`

### Exploit 7: Resume Transfer (Modifying Owner UID)
A user who owns a resume tries to transfer ownership to another user by changing the `userId` during an update.
- **Path**: `/resumes/resume_abc`
- **Original Document**: `{ "userId": "attacker_123", "title": "My Resume", "templateId": "modern" }`
- **Target Payload**:
  ```json
  {
    "userId": "victim_999",
    "title": "My Resume Modified",
    "templateId": "modern"
  }
  ```

### Exploit 8: Timeline Spoofing (Faking Date Fields)
An attacker tries to save a resume with a falsified historical `createdAt` date to overwrite audit records.
- **Path**: `/resumes/resume_abc`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "title": "Future Resume",
    "createdAt": "1999-01-01T00:00:00Z"
  }
  ```

### Exploit 9: Denial-of-Wallet Resource Poisoning (1MB Title String Attack)
An attacker tries to crash or inflate billing by storing a giant, multi-megabyte string inside the `title` field.
- **Path**: `/resumes/resume_abc`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "title": "[REPEATED STRING OF 100,000 CHARACTERS]",
    "resumeData": {}
  }
  ```

### Exploit 10: State Shortcut (Unauthorized Direct Writing to Terminal Fields)
An attacker attempts to write directly into protected analytical fields (`atsScore` or `atsAnalysis`) that must only be computed or saved during a formal ATS audit run.
- **Path**: `/resumes/resume_abc`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "title": "Super Resume",
    "atsScore": 100,
    "atsAnalysis": {
      "score": 100,
      "strengths": ["Attacker is perfect"]
    }
  }
  ```

### Exploit 11: Bulk Harvesting (Blanket Queries Scraping Attempt)
An attacker executes a listing query on `/resumes` without filtering by their own `userId` to scrape all users' resumes in a single operation.
- **Method**: LIST (getDocs on resumes collection without where condition)

### Exploit 12: Orphaned Resume Injection (Faking Parental Sync Relation)
An attacker creates a resume referencing a non-existent template or invalid profile ID.
- **Path**: `/resumes/malicious_orphan_01`
- **Payload**:
  ```json
  {
    "userId": "attacker_123",
    "title": "Malicious Orphan",
    "resumeData": {},
    "templateId": "non_existent_exploit_template"
  }
  ```

---

## 3. Test Runner Definition

These constraints are verified by running unit tests. The file `/src/firestore.rules.test.ts` (or mock-integrated testing routines) describes the security assertions:

- **Auth Rejection**: Undefined credentials reject profile and resume writes.
- **Privilege Lockdown**: Users cannot write keys other than their own assigned profiles.
- **Size Safety**: Unbounded values trigger constraint rejections.

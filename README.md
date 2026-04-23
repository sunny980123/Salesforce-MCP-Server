# Salesforce MCP Server

Salesforce CRM과 Claude를 연결하는 MCP 서버. 레코드 CRUD, SOQL/SOSL, Tooling API, Flow/Apex 메타데이터 추출, Sandbox 관리까지 지원합니다.

**특징**
- 🔐 **SF CLI 기반 자동 토큰 갱신** — 한 번 로그인하면 토큰 만료 걱정 없음
- 🧰 **클론/빌드 불필요** — `npx` 한 줄로 실행
- 🛡️ **안전한 권한 모드** — 삭제 금지 / 읽기 전용
- 🧪 **Prod / Sandbox 분리 접속** — 동일 MCP 서버로 두 org를 별도 등록

---

## 빠른 시작 (팀원 온보딩, 5분)

### 1. 필수 도구 설치

```bash
brew install node sf
npm install -g @anthropic-ai/claude-code
```

> 이미 설치돼 있으면 건너뛰세요. (`node -v`, `sf --version`, `claude --version`으로 확인)

### 2. Salesforce 로그인

```bash
sf org login web --instance-url https://channel-b.my.salesforce.com
```

브라우저에서 `@channel.io` 계정으로 로그인. `Successfully authorized ...` 뜨면 완료.

### 3. MCP 등록 (한 줄 — 본인 이메일만 교체)

```bash
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y github:sunny980123/Salesforce-MCP-Server
```

> ⚠️ **대괄호 금지**. `SALESFORCE_SF_CLI_USERNAME=east@channel.io` 처럼 값만.

### 4. 확인

```bash
claude mcp list
# → salesforce: ... - ✓ Connected
```

Claude Code에서 **"Salesforce에서 최근 생성된 리드 5개 보여줘"** 요청으로 테스트해보세요.

---

## 인증 & 환경변수

SF CLI의 refresh token을 재사용합니다. Security Token, Connected App, JWT 키 전부 불필요.

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `SALESFORCE_SF_CLI_USERNAME` | ✅ | SF CLI에 로그인된 이메일 (예: `jay@channel.io`) |
| `PATH` | ✅ | `/opt/homebrew/bin` 포함 필수 (MCP 프로세스가 `sf` 찾을 수 있도록) |
| `SALESFORCE_NO_DELETE` | ➖ | `true` 시 삭제 차단 (생성/수정은 허용) |
| `SALESFORCE_READONLY` | ➖ | `true` 시 모든 쓰기 차단 (조회만) |

> `PATH`를 빠뜨리면 MCP 서버가 `sf`를 못 찾아 **조용히 실패**합니다.

---

## 권한 모드

팀원 공유 시 아래 2가지 모드 중 하나를 사용하세요. **레코드 삭제 및 메타데이터 배포는 이 서버를 통해 일반 사용자에게 제공되지 않습니다.**

| 모드 | 설정 | 조회 | 생성 | 수정 | 삭제 |
|------|------|:---:|:---:|:---:|:---:|
| 🛡️ 삭제 금지 **(권장)** | `SALESFORCE_NO_DELETE=true` | ✅ | ✅ | ✅ | ❌ |
| 🔒 읽기 전용 | `SALESFORCE_READONLY=true` | ✅ | ❌ | ❌ | ❌ |

### 🛡️ 삭제 금지 모드 (기본 추천)

```bash
claude mcp add -s user salesforce \
  -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io \
  -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
  -e SALESFORCE_NO_DELETE=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### 🔒 읽기 전용 모드 (감사/분석용)

```bash
claude mcp add -s user salesforce \
  -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io \
  -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
  -e SALESFORCE_READONLY=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### 도구별 권한 매트릭스

| 도구 | 삭제 금지 | 읽기 전용 |
|------|:---:|:---:|
| `salesforce_query` | ✅ | ✅ |
| `salesforce_search` | ✅ | ✅ |
| `salesforce_get_record` | ✅ | ✅ |
| `salesforce_describe_object` | ✅ | ✅ |
| `salesforce_list_objects` | ✅ | ✅ |
| `salesforce_get_limits` | ✅ | ✅ |
| `salesforce_metadata_query` | ✅ | ✅ |
| `salesforce_retrieve_metadata` | ✅ | ✅ |
| `salesforce_list_sandboxes` | ✅ | ✅ |
| `salesforce_create_record` | ✅ | ❌ |
| `salesforce_update_record` | ✅ | ❌ |
| `salesforce_delete_record` | ❌ | ❌ |
| `salesforce_deploy_metadata` | ❌ | ❌ |
| `salesforce_create_sandbox` | ❌ | ❌ |

---

## 제공 도구

### 📦 레코드 CRUD (표준 API)

| 도구 | 설명 |
|------|------|
| `salesforce_query` | SOQL 쿼리로 레코드 조회 |
| `salesforce_search` | SOSL로 전체 텍스트 검색 |
| `salesforce_get_record` | ID로 단일 레코드 조회 |
| `salesforce_create_record` | 새 레코드 생성 |
| `salesforce_update_record` | 기존 레코드 수정 |
| `salesforce_delete_record` | 레코드 삭제 (제한적 접근) |
| `salesforce_describe_object` | 오브젝트 필드 메타데이터 조회 |
| `salesforce_list_objects` | 사용 가능한 오브젝트 목록 |
| `salesforce_get_limits` | API 사용량 및 한도 확인 |

### 🔍 Tooling API 조회 — 메타데이터 SOQL

| 도구 | 설명 |
|------|------|
| `salesforce_metadata_query` | Tooling API로 ValidationRule/Flow/Apex 등 메타데이터 조회 |

표준 SOQL로 접근할 수 없는 설정/메타데이터 조회에 사용:

| 조회 대상 | 예시 쿼리 |
|-----------|-----------|
| Validation Rule 전체 목록 | `SELECT Id, ValidationName, Active, EntityDefinitionId FROM ValidationRule` |
| Validation Rule 조건식 (1건) | `SELECT Id, ValidationName, Metadata FROM ValidationRule WHERE Id = '03d...'` |
| 활성 Flow 버전 목록 | `SELECT Id, MasterLabel, Status, VersionNumber FROM Flow WHERE Status = 'Active'` |
| Flow 내부 로직 (1건) | `SELECT Id, MasterLabel, Metadata FROM Flow WHERE Id = '301...'` |
| Apex 클래스 코드 | `SELECT Id, Name, Body FROM ApexClass WHERE Name = 'MyClass'` |
| Apex 트리거 코드 | `SELECT Id, Name, Body FROM ApexTrigger WHERE TableEnumOrId = 'Account'` |

> **주의**: `Metadata` 또는 `FullName` 필드를 포함할 경우 반드시 `WHERE Id = '...'`로 **1건만** 조회해야 합니다.

#### 활용 예시: 특정 필드를 참조하는 모든 로직 찾기

```
1. ValidationRule 목록 조회 (Metadata 없이 전체)
   → SELECT Id, ValidationName, EntityDefinitionId FROM ValidationRule

2. 각 Rule의 Metadata 조회 (1건씩)
   → SELECT Id, ValidationName, Metadata FROM ValidationRule WHERE Id = '03d...'

3. Flow 활성 버전 → Metadata 순차 조회
```

### 📤 메타데이터 추출 — Flow / Apex XML 읽기

| 도구 | 설명 |
|------|------|
| `salesforce_retrieve_metadata` | Flow/ApexClass/ValidationRule 등을 XML로 추출 |

지원 타입: `Flow`, `ApexClass`, `ApexTrigger`, `ValidationRule`, `PermissionSet`, `Layout`, `CustomObject`

**내부 동작**: 임시 SFDX 프로젝트를 만들고 `sf project retrieve start`를 실행합니다. `sf` CLI가 PATH에 있고 `SALESFORCE_SF_CLI_USERNAME`이 설정돼 있어야 합니다.

객체 정의 읽기 권한만 있으면 동작하며, 모든 권한 모드에서 사용 가능합니다.

```
# Claude에 요청 예시
"Existing_Flow라는 Flow의 XML을 가져와서 어떤 조건에서 실행되는지 요약해줘"
→ salesforce_retrieve_metadata(metadata_type="Flow", api_name="Existing_Flow")
```

### 🧪 Sandbox 관리

| 도구 | 설명 |
|------|------|
| `salesforce_list_sandboxes` | 존재하는 sandbox + 생성 중인 SandboxProcess 목록 |
| `salesforce_create_sandbox` | 새 sandbox 생성 (Developer / Dev Pro / Partial / Full) |

두 툴 모두 **prod MCP에서 호출**합니다 (SandboxInfo는 prod org에 저장). `create_sandbox`는 Salesforce 측 "Manage Sandboxes" 권한이 필요합니다.

> Sandbox 생성부터 접속까지의 전체 플로우는 아래 [Sandbox 워크플로우](#sandbox-워크플로우) 참조.

---

## Sandbox 워크플로우

### 생성 → 접속

```
1. (prod MCP에서) sandbox 생성 요청
   Claude에 "Salesforce sandbox 'MyDev' DEVELOPER로 생성해줘" 요청
   → salesforce_create_sandbox 호출됨

2. 진행 상태 확인
   Claude에 "sandbox 생성 진행 상황 보여줘" 요청
   → salesforce_list_sandboxes에서 CopyProgress %

3. 완료 후 터미널에서 sandbox 로그인
   sf org login web -r https://test.salesforce.com
   → 브라우저에서 sandbox username 입력
      (본인이메일@channel.io + "." + sandbox_이름_소문자)
      예: east@channel.io.mydev

4. Sandbox 전용 MCP 추가 등록 (prod MCP와 공존)
   claude mcp add -s user salesforce-sandbox \
     -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io.mydev \
     -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
     -e SALESFORCE_NO_DELETE=true \
     -- npx -y github:sunny980123/Salesforce-MCP-Server
```

Claude Code에서:
- `mcp__salesforce__*` 툴 → prod에 붙음
- `mcp__salesforce-sandbox__*` 툴 → sandbox에 붙음

### Sandbox username 규칙

Prod의 모든 active user는 sandbox 생성 시 **자동 복제**됩니다. 별도 등록 불필요.

| Prod username | Sandbox username (sandbox 이름이 `MyDev`인 경우) |
|------|------|
| `sunny@channel.io` | `sunny@channel.io.mydev` |
| `east@channel.io` | `east@channel.io.mydev` |

- 비밀번호: Developer/Dev Pro는 prod와 동일 (생성 시점 기준). Partial/Full은 Salesforce가 리셋 이메일 발송.
- Email 필드는 `.invalid` 접미사로 자동 스크램블됨 (prod 유저한테 테스트 이메일 발송 방지).
- Inactive user는 복제되지 않습니다.

### 권한

Sandbox MCP에서도 prod와 **동일한 권한 체계** 적용. Deploy/delete가 prod에서 막혀 있는 사용자는 sandbox에서도 막힘 — sandbox는 격리된 환경이지 권한 우회 수단이 아닙니다.

---

## 트러블슈팅

### `NamedOrgNotFoundError: No authorization information found for ...`

`SALESFORCE_SF_CLI_USERNAME` 값이 잘못됐거나, 해당 이메일로 `sf org login web`을 하지 않았습니다.

```bash
# 현재 로그인된 org 확인
sf org list

# 재로그인
sf org login web --instance-url https://channel-b.my.salesforce.com

# MCP 재등록 (이메일 정확히 — 대괄호 없이)
claude mcp remove salesforce -s user
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### `zsh: command not found: claude`

Claude Code CLI가 설치되지 않았습니다.

```bash
npm install -g @anthropic-ai/claude-code
```

### `zsh: command not found: -e`

명령어를 여러 줄로 복붙하다가 줄바꿈이 깨졌습니다. **한 줄로** 복붙하세요.

### `sf: command not found` (MCP 내부 로그)

`PATH` 환경변수를 빠뜨렸습니다. MCP 프로세스는 shell profile을 상속받지 않으니 명시적으로 `/opt/homebrew/bin`을 포함해야 합니다.

### `✓ Connected`인데 툴 호출 시 권한 에러

구버전이 npx 캐시에 남아 있을 수 있습니다:

```bash
rm -rf ~/.npm/_npx
claude mcp remove salesforce -s user
# 다시 add (위 명령어 그대로)
# 그 뒤 Claude Code 완전 재시작
```

### 팀원이 기존 project-scoped 설정과 충돌

이전에 다른 방식으로 등록한 적이 있으면 `~/.claude.json`에 project-scoped 엔트리가 남아 있을 수 있습니다. [GUIDE.md](./GUIDE.md)의 정리 스크립트를 참고하세요.

---

## 소스에서 직접 빌드 (개발자용)

서버 코드를 수정·기여하려는 경우:

```bash
git clone https://github.com/sunny980123/Salesforce-MCP-Server.git
cd Salesforce-MCP-Server
npm install && npm run build
```

로컬 빌드로 MCP 등록:

```bash
claude mcp add -s user salesforce \
  -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io \
  -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
  -e SALESFORCE_NO_DELETE=true \
  -- node ~/Salesforce-MCP-Server/dist/index.cjs
```

---

## 라이선스

MIT

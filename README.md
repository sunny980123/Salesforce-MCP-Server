# Salesforce MCP Server

Salesforce CRM과 Claude를 연결하는 MCP 서버입니다. 표준 SOQL/SOSL 쿼리, 레코드 CRUD, 오브젝트 메타데이터 탐색, **Tooling API(ValidationRule·Flow·Apex 메타데이터)**, **메타데이터 추출(Flow·ApexClass·ValidationRule 등 XML 읽기)** 기능을 제공합니다.

**특징**:
- 🔐 **SF CLI 기반 자동 토큰 갱신** — 한 번 로그인하면 토큰 만료 걱정 없음
- 🧰 **클론/빌드 불필요** — `npx`로 바로 실행
- 🛡️ **안전한 권한 모드** — 삭제 금지 / 읽기 전용

---

## 팀원 온보딩 (5분 완료)

### 1단계: 필수 도구 설치

```bash
brew install node sf
npm install -g @anthropic-ai/claude-code
```

> 이미 설치되어 있으면 건너뛰세요. (`node -v`, `sf --version`, `claude --version`으로 확인)

### 2단계: Salesforce 로그인

```bash
sf org login web --instance-url https://channel-b.my.salesforce.com
```

브라우저가 열리면 본인 `@channel.io` 계정으로 로그인. 터미널에 `Successfully authorized ...` 뜨면 완료입니다.

### 3단계: MCP 서버 등록 (한 줄로 복붙 — 본인 이메일만 교체!)

```bash
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y github:sunny980123/Salesforce-MCP-Server
```

> ⚠️ 대괄호(`[`, `]`)는 쓰지 마세요. `SALESFORCE_SF_CLI_USERNAME=neil@channel.io` 처럼 **값만** 넣으세요.

### 4단계: 확인

```bash
claude mcp list
```

`salesforce: ... - ✓ Connected` 가 보이면 완료 🎉

이후 Claude Code에서 **"Salesforce에서 최근 생성된 리드 5개 보여줘"** 같은 요청으로 테스트해보세요.

---

## 인증 방식

이 서버는 **Salesforce CLI를 통한 자동 토큰 갱신** 방식을 사용합니다. Security Token, Connected App, JWT 키 설정 모두 필요 없습니다.

- SF CLI가 refresh token을 관리 → 토큰 만료 시 자동 재발급
- 사용자가 `sf org logout` 하지 않는 한 토큰 갱신 신경 쓸 필요 없음

### 환경변수

| 변수 | 필수 | 설명 |
|------|:---:|------|
| `SALESFORCE_SF_CLI_USERNAME` | ✅ | SF CLI에 로그인된 이메일 (예: `jay@channel.io`) |
| `PATH` | ✅ | `/opt/homebrew/bin` 포함 필수 (MCP 프로세스가 `sf` 찾을 수 있도록) |
| `SALESFORCE_NO_DELETE` | ➖ | `true` 시 삭제만 차단 (생성/수정은 허용) |
| `SALESFORCE_READONLY` | ➖ | `true` 시 모든 쓰기 차단 (조회만) |

> `PATH`를 빠뜨리면 MCP 서버가 `sf` 명령어를 못 찾아 **조용히 실패**합니다. 꼭 포함하세요.

---

## 권한 모드

팀원 공유 시 아래 2가지 모드 중 하나를 사용하세요. **레코드 삭제 및 메타데이터 배포는 이 서버를 통해 제공되지 않습니다.**

| 모드 | 설정 | 조회 | 생성 | 수정 | 삭제 |
|------|------|:---:|:---:|:---:|:---:|
| 🛡️ 삭제 금지 **(권장)** | `SALESFORCE_NO_DELETE=true` | ✅ | ✅ | ✅ | ❌ |
| 🔒 읽기 전용 | `SALESFORCE_READONLY=true` | ✅ | ❌ | ❌ | ❌ |

### 🛡️ 삭제 금지 모드 (팀원 공유 추천)

실수로 데이터가 지워지는 걸 방지하면서 일반 CRM 작업은 모두 허용합니다.

```bash
claude mcp add -s user salesforce \
  -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io \
  -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin \
  -e SALESFORCE_NO_DELETE=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### 🔒 읽기 전용 모드

조회만 허용. 감사/분석 용도로 안전하게 공유할 때 사용합니다.

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
| `salesforce_create_record` | ✅ | ❌ |
| `salesforce_update_record` | ✅ | ❌ |
| `salesforce_delete_record` | ❌ | ❌ |
| `salesforce_deploy_metadata` | ❌ | ❌ |

---

## 트러블슈팅

### `NamedOrgNotFoundError: No authorization information found for ...`

→ `SALESFORCE_SF_CLI_USERNAME` 값이 잘못되었거나, 해당 이메일로 `sf org login web`을 하지 않았습니다.

```bash
# 현재 로그인된 org 확인
sf org list

# 필요하면 재로그인
sf org login web --instance-url https://channel-b.my.salesforce.com

# MCP 재등록 (이메일 정확히 입력 — 대괄호 X)
claude mcp remove salesforce -s user
claude mcp add -s user salesforce -e SALESFORCE_SF_CLI_USERNAME=본인이메일@channel.io -e PATH=/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin -e SALESFORCE_NO_DELETE=true -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### `zsh: command not found: claude`

→ Claude Code CLI가 설치되지 않았습니다.

```bash
npm install -g @anthropic-ai/claude-code
```

### `sf: command not found` (MCP 서버 내부 로그)

→ `PATH` 환경변수를 빠뜨렸습니다. MCP 프로세스는 shell profile을 상속받지 않으므로 명시적으로 `/opt/homebrew/bin`을 추가해야 합니다.

### 팀원이 기존 project-scoped 설정과 충돌

이전에 다른 방식으로 등록한 적이 있으면 `~/.claude.json`에 project-scoped 엔트리가 남아있을 수 있습니다. [GUIDE.md](./GUIDE.md)의 정리 스크립트를 참고하세요.

---

## 제공 도구

### 📦 표준 API (CRM 데이터)

| 도구 | 설명 |
|------|------|
| `salesforce_query` | SOQL 쿼리로 레코드 조회 |
| `salesforce_search` | SOSL로 전체 텍스트 검색 |
| `salesforce_get_record` | ID로 단일 레코드 조회 |
| `salesforce_create_record` | 새 레코드 생성 |
| `salesforce_update_record` | 기존 레코드 수정 |
| `salesforce_delete_record` | 레코드 삭제 |
| `salesforce_describe_object` | 오브젝트 필드 메타데이터 조회 |
| `salesforce_list_objects` | 사용 가능한 오브젝트 목록 조회 |
| `salesforce_get_limits` | API 사용량 및 한도 확인 |

### 🔧 Tooling API (메타데이터/설정)

| 도구 | 설명 |
|------|------|
| `salesforce_metadata_query` | Tooling API로 메타데이터 오브젝트 조회 |

표준 SOQL로 접근할 수 없는 설정/메타데이터 조회에 사용합니다:

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
1. ValidationRule 목록 조회 (Metadata 없이 전체 조회)
   → SELECT Id, ValidationName, EntityDefinitionId FROM ValidationRule

2. 각 Rule의 Metadata 조회 (1건씩)
   → SELECT Id, ValidationName, Metadata FROM ValidationRule WHERE Id = '03d...'

3. Flow 활성 버전 목록 조회
   → SELECT Id, MasterLabel, Status FROM Flow WHERE Status = 'Active'

4. 특정 Flow의 전체 로직 조회
   → SELECT Id, MasterLabel, Metadata FROM Flow WHERE Id = '301...'
```

### 🚀 메타데이터 추출 (Flow·Apex XML 읽기)

| 도구 | 설명 |
|------|------|
| `salesforce_retrieve_metadata` | Flow/ApexClass/ValidationRule 등을 XML로 추출 (읽기 전용) |

지원 타입: `Flow`, `ApexClass`, `ApexTrigger`, `ValidationRule`, `PermissionSet`, `Layout`, `CustomObject`

**내부 동작**: 임시 SFDX 프로젝트를 만들고 로컬의 `sf project retrieve start` 명령을 실행합니다. 따라서 **`sf` CLI가 PATH에 있고 `SALESFORCE_SF_CLI_USERNAME`이 설정돼 있어야** 합니다.

객체 정의 읽기 권한만 있으면 동작하며, 모든 권한 모드(삭제 금지 / 읽기 전용)에서 사용 가능합니다.

#### 예시: 기존 Flow XML 읽어 분석

```
salesforce_retrieve_metadata(metadata_type="Flow", api_name="Existing_Flow")
→ XML을 받아서 Flow 로직 분석, Claude가 요약 또는 개선안 제시
```

---

## 소스에서 직접 빌드 (개발자용)

서버 코드를 수정하거나 기여하려는 경우:

```bash
git clone https://github.com/sunny980123/Salesforce-MCP-Server.git
cd Salesforce-MCP-Server
npm install && npm run build
```

Claude Code에 로컬 빌드로 등록:

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

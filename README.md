# Salesforce MCP Server

Salesforce CRM과 Claude를 연결하는 MCP 서버입니다. 표준 SOQL/SOSL 쿼리, 레코드 CRUD, 오브젝트 메타데이터 탐색, **Tooling API(ValidationRule·Flow·Apex 메타데이터)** 기능을 제공합니다.

## 팀원 온보딩 (처음 설치하는 경우)

**클론/빌드 필요 없음!** 아래 순서대로 따라하면 5분 안에 완료됩니다.

### 1단계: SF CLI 설치

```bash
brew install sf
```

### 2단계: Salesforce 로그인

```bash
sf org login web --instance-url https://[회사 org 주소].my.salesforce.com
```

→ 브라우저가 열리면 본인 계정으로 로그인

### 3단계: 토큰 확인

```bash
sf org display --target-org [본인 이메일] --json
```

결과에서 두 값을 복사해두세요:

```json
{
  "accessToken": "00D2w...  ← SALESFORCE_ACCESS_TOKEN",
  "instanceUrl": "https://xxx.my.salesforce.com  ← SALESFORCE_INSTANCE_URL"
}
```

### 4단계: MCP 서버 등록

```bash
claude mcp add salesforce \
  -e SALESFORCE_ACCESS_TOKEN=여기에붙여넣기 \
  -e SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com \
  -e SALESFORCE_READONLY=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

### 5단계: 확인

```bash
claude mcp list
```

`salesforce` 서버가 목록에 보이면 완료입니다 🎉

---

## 토큰 만료 시 갱신

```bash
# 토큰 재발급
sf org login web --instance-url https://[org 주소].my.salesforce.com
sf org display --target-org [본인 이메일] --json

# MCP 재등록
claude mcp remove salesforce
claude mcp add salesforce \
  -e SALESFORCE_ACCESS_TOKEN=새토큰 \
  -e SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com \
  -e SALESFORCE_READONLY=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

---

## 소스에서 직접 빌드 (개발자용)

**처음 설치하는 경우** → [GUIDE.md](./GUIDE.md) 를 따라주세요. (비개발자도 따라할 수 있는 단계별 가이드)

```bash
git clone https://github.com/sunny980123/Salesforce-MCP-Server.git
cd Salesforce-MCP-Server
npm install && npm run build
```

Claude Code 설정:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "node",
      "args": ["/Users/[유저명]/Downloads/Salesforce-MCP-Server/dist/index.js"],
      "env": {
        "SALESFORCE_ACCESS_TOKEN": "00D2w...",
        "SALESFORCE_INSTANCE_URL": "https://yourorg.my.salesforce.com"
      }
    }
  }
}
```

---

## 인증 방식

이 서버는 **Salesforce CLI를 통한 Access Token** 방식을 사용합니다. Security Token이나 Connected App 설정이 필요 없습니다.

### 환경변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `SALESFORCE_ACCESS_TOKEN` | ✅ | SF CLI로 발급한 Access Token |
| `SALESFORCE_INSTANCE_URL` | ✅ | Salesforce org URL (예: `https://yourorg.my.salesforce.com`) |
| `SALESFORCE_READONLY` | ➖ | `true`로 설정 시 조회만 가능 (생성·수정·삭제 차단) |

### 권한 모드

#### 🔓 풀 액세스 (기본값)
조회, 생성, 수정, 삭제 모두 가능합니다.

```bash
claude mcp add salesforce \
  -e SALESFORCE_ACCESS_TOKEN=00D2w... \
  -e SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

#### 🔒 읽기 전용 모드 (팀원 공유 추천)
조회·검색만 가능하며, 생성·수정·삭제 시도 시 오류를 반환합니다.

```bash
claude mcp add salesforce \
  -e SALESFORCE_ACCESS_TOKEN=00D2w... \
  -e SALESFORCE_INSTANCE_URL=https://yourorg.my.salesforce.com \
  -e SALESFORCE_READONLY=true \
  -- npx -y github:sunny980123/Salesforce-MCP-Server
```

| 도구 | 풀 액세스 | 읽기 전용 |
|------|:---------:|:---------:|
| `salesforce_query` | ✅ | ✅ |
| `salesforce_search` | ✅ | ✅ |
| `salesforce_get_record` | ✅ | ✅ |
| `salesforce_describe_object` | ✅ | ✅ |
| `salesforce_list_objects` | ✅ | ✅ |
| `salesforce_get_limits` | ✅ | ✅ |
| `salesforce_tooling_query` | ✅ | ✅ |
| `salesforce_create_record` | ✅ | ❌ |
| `salesforce_update_record` | ✅ | ❌ |
| `salesforce_delete_record` | ✅ | ❌ |

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
| `salesforce_tooling_query` | Tooling API로 메타데이터 오브젝트 조회 |

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

---


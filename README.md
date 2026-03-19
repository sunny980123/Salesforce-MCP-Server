# Salesforce MCP Server

Salesforce CRM과 Claude를 연결하는 MCP 서버입니다. SOQL 쿼리, 레코드 조회/생성/수정/삭제, 오브젝트 메타데이터 탐색 기능을 제공합니다.

## 빠른 시작

**처음 설치하는 경우** → [GUIDE.md](./GUIDE.md) 를 따라주세요. (비개발자도 따라할 수 있는 단계별 가이드)

---

## 인증 방식

이 서버는 **Salesforce CLI를 통한 Access Token** 방식을 사용합니다. Security Token이나 Connected App 설정이 필요 없습니다.

### 환경변수

| 변수 | 설명 |
|------|------|
| `SALESFORCE_ACCESS_TOKEN` | SF CLI로 발급한 Access Token |
| `SALESFORCE_INSTANCE_URL` | Salesforce org URL (예: `https://yourorg.my.salesforce.com`) |

### Access Token 발급 방법

```bash
# 1. Salesforce CLI 설치
brew install sf

# 2. 브라우저 로그인으로 인증
sf org login web --instance-url https://[내 org 주소].my.salesforce.com

# 3. Access Token 확인
sf org display --target-org [내 이메일] --json
```

### Claude Desktop 설정 (`claude_desktop_config.json`)

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

## 빌드

```bash
npm install
npm run build
```

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

## 토큰 만료 시 갱신

```bash
sf org login web --instance-url https://[내 org 주소].my.salesforce.com
sf org display --target-org [내 이메일] --json
```

`claude_desktop_config.json`의 `SALESFORCE_ACCESS_TOKEN` 값을 새 토큰으로 교체 후 Claude Desktop 재시작.

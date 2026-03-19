# Salesforce MCP Server

Salesforce CRM과 Claude를 연결하는 MCP 서버입니다. SOQL 쿼리, 레코드 조회/생성/수정/삭제, 오브젝트 메타데이터 탐색 기능을 제공합니다.

## 사전 준비: Salesforce Connected App 설정

1. Salesforce Setup → **Apps → App Manager → New Connected App**
2. **OAuth Settings** 활성화
   - Callback URL: `https://localhost/callback` (임시값 사용 가능)
   - OAuth Scopes: `Full access (full)` 또는 `API (api)`
3. 저장 후 **Consumer Key**와 **Consumer Secret** 복사
4. Setup → **Personal Settings → Reset My Security Token** 으로 보안 토큰 발급

## 환경변수 설정

```bash
export SALESFORCE_CLIENT_ID="Consumer Key 값"
export SALESFORCE_CLIENT_SECRET="Consumer Secret 값"
export SALESFORCE_USERNAME="your@email.com"
export SALESFORCE_PASSWORD="비밀번호보안토큰"  # 비밀번호 + 보안토큰 붙여서 입력

# Sandbox 사용 시 (선택사항)
export SALESFORCE_LOGIN_URL="https://test.salesforce.com"

# API 버전 (선택사항, 기본값: v59.0)
export SALESFORCE_API_VERSION="v59.0"
```

> **SALESFORCE_PASSWORD**: 비밀번호와 보안토큰을 공백 없이 붙여씁니다.
> 예: 비밀번호가 `MyPass123`, 보안토큰이 `ABC123` → `MyPass123ABC123`

## Claude Desktop 설정

`~/Library/Application Support/Claude/claude_desktop_config.json`에 추가:

```json
{
  "mcpServers": {
    "salesforce": {
      "command": "node",
      "args": ["/Users/sunny/Downloads/salesforce-mcp-server/dist/index.js"],
      "env": {
        "SALESFORCE_CLIENT_ID": "Consumer Key 값",
        "SALESFORCE_CLIENT_SECRET": "Consumer Secret 값",
        "SALESFORCE_USERNAME": "your@email.com",
        "SALESFORCE_PASSWORD": "비밀번호보안토큰"
      }
    }
  }
}
```

## 빌드 및 실행

```bash
npm install
npm run build
npm start
```

## 제공 도구

| 도구 | 설명 |
|------|------|
| `salesforce_query` | SOQL 쿼리로 레코드 조회 |
| `salesforce_search` | SOSL로 전체 텍스트 검색 |
| `salesforce_get_record` | ID로 단일 레코드 조회 |
| `salesforce_create_record` | 새 레코드 생성 |
| `salesforce_update_record` | 기존 레코드 수정 |
| `salesforce_delete_record` | 레코드 삭제 (휴지통으로 이동) |
| `salesforce_describe_object` | 오브젝트 필드 메타데이터 조회 |
| `salesforce_list_objects` | 사용 가능한 오브젝트 목록 조회 |
| `salesforce_get_limits` | API 사용량 및 한도 확인 |

## 사용 예시

Claude에서 다음과 같이 사용할 수 있습니다:

```
"기술 업종 거래처 목록 보여줘"
→ salesforce_query: SELECT Id, Name, Industry, Phone FROM Account WHERE Industry = 'Technology'

"새로운 리드 등록해줘: 홍길동, 삼성전자, hong@samsung.com"
→ salesforce_create_record: Lead { LastName, Company, Email }

"이번 분기 마감 예정인 상담 기회 조회해줘"
→ salesforce_query: SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE CloseDate = THIS_QUARTER

"Contact 오브젝트에 어떤 필드들이 있어?"
→ salesforce_describe_object: Contact
```

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

---

## 토큰 만료 시 갱신

```bash
sf org login web --instance-url https://[내 org 주소].my.salesforce.com
sf org display --target-org [내 이메일] --json
```

`claude_desktop_config.json`의 `SALESFORCE_ACCESS_TOKEN` 값을 새 토큰으로 교체 후 Claude Desktop 재시작.

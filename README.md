# Segament Data Updater

Chunithm 음악 데이터 업데이터 - Chunirec API 데이터와 Google Sheets 상수 데이터를 병합하여 Segament용 음악 데이터를 생성하는 도구입니다.

## 주요 기능

- **Chunirec API 연동**: 최신 Chunithm 음악 데이터 자동 수집
- **Google Sheets 통합**: 구글 시트에서 상수 데이터 및 신곡 정보 가져오기
- **신곡 자동 감지**: 新曲のみ 시트에서 신곡을 자동으로 감지하고 추가
- **Segament ID 생성**: SHA-1 해시를 이용한 고유 Segament ID 자동 생성
- **안정성 보장**: 新曲のみ 시트에서만 신곡 추가, 다른 시트는 상수만 업데이트
- **데이터 무결성**: 중복 곡 방지 및 상수 정확성 검증

## 프로젝트 구조

```
segament-data-updater/
├── node_modules/            # npm 패키지들
├── data/
│   └── chunithm-music.json  # 최종 결과물 (Segament용 JSON 파일)
├── src/
│   └── index.js             # 핵심 로직 파일
├── .env                     # 환경 변수 (API 키, 시트 ID 등)
├── package.json
└── README.md
```

## 설치 방법

1. 프로젝트 폴더로 이동:

```bash
cd segament-data-updater
```

2. 의존성 패키지 설치:

```bash
npm install
```

3. 환경 변수 설정:

`.env` 파일을 생성하고 다음 내용을 입력하세요:

```env
# Chunirec API 설정
CHUNIREC_ACCESS_TOKEN=발급받은_chunirec_액세스_토큰
#username 설정 : 페이지 우측 상단에 usernameさん으로 표시됩니다.
CHUNIREC_USER_NAME="username"

# Google Sheets API 설정
GOOGLE_API_KEY=발급받은_구글_API_키
GOOGLE_SHEET_ID=구글_스프레드시트_ID

# 출력 설정
OUTPUT_JSON_PATH=./data/chunithm-music.json
```

## 사용 방법

### 1. Chunirec API 토큰 발급
- [Chunirec](https://developer.chunirec.net/manage/)에 로그인
- 프로필 설정에서 API 토큰 발급
- `.env` 파일의 `CHUNIREC_ACCESS_TOKEN`에 설정

### 2. Google Sheets API 설정
- [Google Cloud Console](https://console.cloud.google.com/)에서 프로젝트 생성
- Google Sheets API 활성화
- API 키 발급 후 `.env` 파일의 `GOOGLE_API_KEY`에 설정

### 3. Google Sheets 준비
스프레드시트는 다음 시트들을 포함해야 합니다:

- **新曲のみ**: 신곡 정보 (6열 그룹: 곡명, BAS, ADV, EXP, MAS, ULT)
- **15,15+**: 상수 15.0~15.9 곡들
- **14+**: 상수 14.5~14.9 곡들  
- **14**: 상수 14.0~14.4 곡들
- **13.8～13.9**: 상수 13.8~13.9 곡들
- **13.5～13.7**: 상수 13.5~13.7 곡들
- **13**: 상수 13.0~13.4 곡들
- **12+**: 상수 12.5~12.9 곡들
- **12**: 상수 12.0~12.4 곡들
- **11+**: 상수 11.5~11.9 곡들
- **11以下**: 상수 11.4 이하 곡들

- 단, CHUNITHM【チュウニズム】攻略Wiki의 스프레드시트를 기준으로 데이터를 갱신하므로, 유저가 임의의 데이터를 조작할 필요는 없습니다.

각 상수 시트의 컬럼 구조:
- A열: 곡명
- B열: 난이도 (BAS, ADV, EXP, MAS, ULT)
- C열: 상수값

### 4. 프로그램 실행

```bash
npm start
```

또는

```bash
npm run update
```

### 5. 결과 확인
- 처리된 데이터는 `data/chunithm-music.json` 파일로 저장됩니다.
- 로그를 통해 신곡 추가 및 상수 업데이트 현황을 확인할 수 있습니다.

## 작동 원리

1. **API 데이터 수집**: Chunirec API에서 최신 악곡 데이터를 가져옵니다.
2. **Google Sheets 데이터 읽기**: 모든 상수 시트와 新曲のみ 시트에서 데이터를 수집합니다.
3. **신곡 감지**: 新曲のみ 시트에서만 신곡을 감지하고 Segament ID를 생성합니다.
4. **데이터 병합**: 
   - 기존 곡: 상수 값만 업데이트
   - 신곡: 新曲のみ 시트에서만 추가 (안정성 보장)
5. **후처리**: 상수가 0인 보면에 레벨값을 적용합니다.
6. **결과 저장**: 최종 데이터를 Segament용 JSON 형식으로 저장합니다.

## 데이터 구조

생성되는 JSON 파일의 구조:

```json
{
  "meta": {
    "id": "segament_생성_고유_ID",
    "title": "곡명",
    "genre": "장르",
    "artist": "아티스트",
    "release": "발매일",
    "bpm": 120
  },
  "data": {
    "BAS": {
      "level": "12+",
      "const": 12.7,
      "maxcombo": 500,
      "is_const_unknown": false
    }
  }
}
```

## 안전 기능

- **신곡 중복 방지**: Chunirec API에 이미 존재하는 곡은 신곡으로 추가하지 않음
- **데이터 무결성**: 新曲のみ 시트에서만 신곡 추가, 다른 시트는 상수만 업데이트
- **상세한 로깅**: 모든 처리 과정을 로그로 기록하여 추적 가능
- **오류 처리**: API 인증 실패 시 공개 API로 자동 전환

## 의존성

- `axios`: HTTP 요청을 위한 라이브러리
- `googleapis`: Google Sheets API 연동을 위한 라이브러리  
- `dotenv`: 환경 변수 관리를 위한 라이브러리
- `fs-extra`: 파일 시스템 작업을 위한 확장 라이브러리
- `crypto`: SHA-1 해시를 이용한 Segament ID 생성

## 주의사항

- Chunirec API 토큰은 개인 정보이므로 절대 공유하지 마세요.
- Google Sheets는 반드시 공개 읽기 권한이 설정되어야 합니다.
- 新曲のみ 시트의 6열 그룹 구조를 정확히 유지해야 합니다.

## 문제 해결

### API 인증 오류
- `.env` 파일의 `CHUNIREC_ACCESS_TOKEN` 확인
- 토큰이 유효한지 Chunirec 웹사이트에서 확인

### Google Sheets 오류  
- 스프레드시트가 공개 읽기 권한으로 설정되었는지 확인
- `GOOGLE_API_KEY`와 `GOOGLE_SHEET_ID`가 올바른지 확인
- Google Cloud Console에서 Google Sheets API가 활성화되었는지 확인

### 신곡이 추가되지 않는 경우
- 新曲のみ 시트에 곡이 제대로 입력되었는지 확인
- 해당 곡이 이미 Chunirec API에 존재하는지 로그 확인

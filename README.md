# Segament Data Updater

**CHUNITHM-NET의 공식 악곡 목록을 기반으로, 외부 API 및 상수 데이터를 통합하여 `chunithm-music.json`을 생성하고 관리하는 데스크톱 애플리케이션입니다.**

## 프로젝트 목표

기존의 `chunirec` API 중심 데이터 수집 방식에서 벗어나, CHUNITHM-NET에서 직접 추출한 **공식 악곡 목록**을 마스터 데이터로 사용합니다. 이 데이터를 기반으로 `chunirec` API와 Google Sheets의 상수 정보를 결합하여, 정확하고 유지보수가 용이한 최종 악곡 데이터(`chunithm-music.json`)를 생성하는 것을 목표로 합니다.

## 핵심 데이터 흐름

1.  **[데이터 수집] 북마크릿 실행**:
    * 사용자가 CHUNITHM-NET 악곡 목록 페이지에서 전용 북마크릿을 실행하여, `idx`, `level`, `difficulty`, `genre`, `version`이 포함된 **전체 악곡 목록 JSON 파일**을 로컬에 다운로드합니다. 이 파일이 모든 데이터 처리의 시작점이 됩니다.

2.  **[데이터 보강] `chunirec` API 연동**:
    * 애플리케이션이 로컬의 악곡 목록 JSON을 읽어들입니다.
    * 각 악곡의 **곡명(title)**을 기준으로 `chunirec` API에 조회하여, 보면별 **상수(const)** 데이터를 가져와 병합합니다.

3.  **[데이터 정제] Google Sheets 연동**:
    * `chunirec`에 없거나 부정확한 최신 곡의 상수 정보를 Google Sheets에서 불러옵니다.
    * 이 정보는 `chunirec` API 데이터보다 우선 적용되어 데이터의 최신성과 정확성을 보장합니다.

4.  **[데이터 관리] UI 기반 애플리케이션**:
    * 위 모든 과정은 Windows 기반 데스크톱 UI 애플리케이션 내에서 버튼 클릭으로 실행됩니다.
    * UI를 통해 병합 과정에서 발생한 누락 또는 불일치 데이터를 시각적으로 확인하고, 개발자가 직접 **수정 및 예외 처리**를 할 수 있는 편집 기능을 제공합니다.
    * 최종 검수가 완료되면, 버튼 클릭으로 `data/chunithm-music.json` 파일을 생성 및 저장합니다.

## 설치 및 실행

**요구사항:**
-   Windows 운영체제
-   Node.js (내부 실행 환경)

1.  **애플리케이션 실행**:
    * 제공된 Windows용 실행 파일(`.exe`)을 실행합니다.

2.  **환경 변수 설정**:
    * 최초 실행 시 또는 설정 메뉴를 통해 `.env` 파일에 필요한 API 키를 설정합니다.
    ```env
    # Chunirec API 설정
    CHUNIREC_ACCESS_TOKEN=발급받은_chunirec_액세스_토큰

    # Google Sheets API 설정
    GOOGLE_API_KEY=발급받은_구글_API_키
    GOOGLE_SHEET_ID=구글_스프레드시트_ID
    ```

## 사용 방법 (UI 애플리케이션 기준)

1.  **악곡 목록 가져오기**: CHUNITHM-NET에서 북마크릿으로 다운로드한 `json` 파일을 "불러오기" 버튼으로 선택합니다.
2.  **데이터 업데이트 실행**: "업데이트 시작" 버튼을 클릭하면 `chunirec` API 및 Google Sheets 연동이 자동으로 실행됩니다.
3.  **데이터 검수 및 수정**: 처리 로그와 데이터 테이블을 통해 누락되거나 충돌하는 데이터를 확인하고, 내장된 편집기로 직접 수정합니다.
4.  **최종 파일 생성**: "JSON 파일 저장" 버튼을 눌러 `data/chunithm-music.json`을 최종적으로 생성합니다.
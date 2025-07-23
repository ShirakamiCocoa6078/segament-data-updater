# Segament Data Updater 아키텍처

## 1. 개요

본 시스템은 **사용자(개발자)의 로컬 환경**에서 실행되는 Windows UI 애플리케이션을 중심으로 설계되었습니다. 데이터 수집의 시작점은 CHUNITHM-NET에서 북마크릿을 통해 생성된 로컬 JSON 파일이며, 이 파일을 기준으로 외부 데이터를 병합하고 최종 결과물을 생성하는 파이프라인을 구축합니다.

## 2. 시스템 구성도

```mermaid
graph TD
    subgraph 사용자 PC
        A[CHUNITHM-NET 접속<br>(브라우저)] -- 북마크릿 실행 --> B{로컬 악곡 목록.json};
        
        subgraph Windows UI 애플리케이션
            C[데이터 로더]
            D[데이터 처리 엔진]
            E[데이터 편집기/뷰어]
            F[JSON 파일 생성기]
        end

        B -- "파일 열기" --> C;
        C -- "데이터 전달" --> D;
        D -- "곡명 기준 조회" --> G[chunirec API];
        D -- "상수 조회/보정" --> H[Google Sheets API];
        G -- "상수 데이터" --> D;
        H -- "최신 상수 데이터" --> D;
        D -- "병합된 데이터/로그 전달" --> E;
        E -- "수정된 데이터" --> F;
        F -- "파일 저장" --> I{chunithm-music.json};
    end

    subgraph 외부 서비스
        G; H;
    end
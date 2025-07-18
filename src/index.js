// 파일 경로: /src/index.js
require('dotenv').config(); // .env 파일의 환경 변수를 로드합니다.

const axios = require('axios');
const { google } = require('googleapis');
const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');

// --- .env 파일에서 설정값 불러오기 ---
const { 
    CHUNIREC_ACCESS_TOKEN, 
    CHUNIREC_USER_NAME, 
    GOOGLE_API_KEY, 
    GOOGLE_SHEET_ID 
} = process.env;

// --- 설정 (Configuration) ---
const SHEET_NAMES_TO_FETCH = [
    '新曲のみ', '15,15+', '14+', '14', '13.8～13.9', 
    '13.5～13.7', '13', '12+', '12', '11+', '11以下'
];
const API_BASE_URL = 'https://api.chunirec.net/2.0';
const OUTPUT_JSON_PATH = path.join(__dirname, '../data/chunithm-music.json');

// API 호출을 위한 공통 헤더 및 파라미터 설정 (인증 방식 2 기본 사용)
const apiConfig = {
    params: {
        region: 'jp2',
        token: CHUNIREC_ACCESS_TOKEN,
        user_name: CHUNIREC_USER_NAME || undefined // user_name이 없으면 파라미터에서 제외
    }
};

/**
 * 곡 제목을 정규화합니다 (특수문자, 대소문자, 공백 제거)
 */
function normalizeTitle(title) {
    if (!title) return '';
    
    return title
        .toLowerCase() // 소문자 변환
        .replace(/[！-～]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)) // 전각→반각
        .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '') // 특수문자 및 공백 제거 (일본어 유지)
        .trim();
}

/**
 * Segament 전용 고유 ID를 생성합니다
 */
function generateSegamentId(title, artist = '', isWorldsEnd = false, originalId = '') {
    let baseString = normalizeTitle(title);
    
    // WORLD'S END 곡의 경우 원본 ID + "segament" 추가
    if (isWorldsEnd && originalId) {
        baseString = `${originalId}segament`;
    } else if (artist) {
        // 아티스트 정보가 있으면 충돌 방지를 위해 추가
        baseString += normalizeTitle(artist);
    }
    
    // SHA-1 해시 생성 후 앞 16자리 사용
    const hash = crypto.createHash('sha1').update(baseString, 'utf8').digest('hex');
    return hash.substring(0, 16);
}

/**
 * 스프레드시트의 난이도 표기를 API의 표기로 변환합니다.
 */
function normalizeDifficulty(sheetDifficulty) {
    if (!sheetDifficulty || typeof sheetDifficulty !== 'string') return '';
    const upperDiff = sheetDifficulty.toUpperCase();
    const map = {
        'MASTER': 'MAS', 'ULTIMA': 'ULT', 'EXPERT': 'EXP',
        'ADVANCED': 'ADV', 'BASIC': 'BAS'
    };
    return map[upperDiff] || upperDiff;
}

/**
 * Google 스프레드시트에서 모든 관련 데이터를 가져옵니다.
 * @returns {Promise<{sheetDataMap: Map<string, Object>, newSongsFromSheetOnly: Map<string, Object>}>}
 */
async function fetchAllDataFromGoogleSheet() {
    console.log(`[2/5] Google 스프레드시트에서 모든 데이터를 가져오는 중...`);
    if (!GOOGLE_API_KEY || !GOOGLE_SHEET_ID) {
        throw new Error('.env 파일에 GOOGLE_API_KEY와 GOOGLE_SHEET_ID를 설정해주세요.');
    }

    const sheets = google.sheets({ version: 'v4', auth: GOOGLE_API_KEY });
    const sheetDataMap = new Map();
    const newSongsFromSheetOnly = new Map(); // 新曲のみ 시트에서만 발견된 곡들

    for (const sheetName of SHEET_NAMES_TO_FETCH) {
        try {
            console.log(`  - 시트 '${sheetName}' 읽는 중...`);
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: GOOGLE_SHEET_ID,
                range: sheetName,
            });

            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                console.warn(`  - 경고: '${sheetName}' 시트가 비어있습니다.`);
                continue;
            }

            // '新曲のみ' 시트 처리 - 신곡 데이터 별도 수집
            if (sheetName === '新曲のみ') {
                // 헤더 찾기
                let headerRowIndex = -1;
                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i];
                    if (row && row[0] === '曲名') {
                        headerRowIndex = i;
                        break;
                    }
                }
                
                if (headerRowIndex === -1) {
                    console.warn(`  - 경고: '${sheetName}' 시트에서 헤더를 찾을 수 없습니다.`);
                    continue;
                }
                
                // 데이터 처리 (헤더 다음 행부터)
                for (let i = headerRowIndex + 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;
                    
                    // 6열씩 그룹으로 처리 (曲名, 譜面, ジャンル, 表示Lv, 定数, 빈칸)
                    for (let j = 0; j < row.length; j += 6) {
                        const title = row[j];
                        const difficulty = normalizeDifficulty(row[j + 1]);
                        const genre = row[j + 2];
                        const level = row[j + 3];
                        const constant = parseFloat(row[j + 4]);

                        if (title && title.trim() !== '' && difficulty) {
                            const key = `${title}-${difficulty}`;
                            
                            // 일반 상수 맵에 추가
                            sheetDataMap.set(key, { 
                                const: !isNaN(constant) ? constant : null,
                                level: level || null,
                                genre: genre || null
                            });
                            
                            // 新曲のみ 전용 신곡 맵에 추가 (곡별로 그룹핑)
                            if (!newSongsFromSheetOnly.has(title)) {
                                newSongsFromSheetOnly.set(title, {
                                    title: title,
                                    genre: genre || 'VARIETY',
                                    difficulties: new Map()
                                });
                            }
                            
                            newSongsFromSheetOnly.get(title).difficulties.set(difficulty, {
                                level: level || null,
                                const: !isNaN(constant) ? constant : null
                            });
                        }
                    }
                }
            } 
            // 나머지 시트 처리 - 상수 업데이트만
            else {
                const header = rows.find(row => row.includes('曲名'));
                if (!header) {
                    console.warn(`  - 경고: '${sheetName}' 시트에서 헤더를 찾을 수 없습니다.`);
                    continue;
                }
                const colMap = header.reduce((map, col, index) => ({ ...map, [col]: index }), {});
                
                const dataStartIndex = rows.indexOf(header) + 1;
                for (let i = dataStartIndex; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0) continue;
                    
                    const title = row[colMap['曲名']];
                    const difficulty = normalizeDifficulty(row[colMap['譜面']]);
                    
                    if (!title || !difficulty) continue;

                    const xvrsConst = parseFloat(row[colMap['XVRS']]);
                    const vrsConst = parseFloat(row[colMap['VRS']]);
                    const constant = !isNaN(xvrsConst) ? xvrsConst : vrsConst;

                    const key = `${title}-${difficulty}`;
                    sheetDataMap.set(key, { 
                        const: !isNaN(constant) ? constant : null,
                        level: null, // 기존 시트에는 레벨 정보 없음
                        genre: null // 기존 시트에는 장르 정보 없음
                    });
                }
            }
        } catch (error) {
            console.error(`  - '${sheetName}' 시트 처리 중 오류 발생: ${error.message}`);
        }
    }
    console.log(`  - 총 ${sheetDataMap.size}개의 고유 곡/난이도 데이터를 성공적으로 불러왔습니다.`);
    console.log(`  - 新曲のみ 시트에서 ${newSongsFromSheetOnly.size}개의 신곡 후보를 발견했습니다.`);
    
    return { sheetDataMap, newSongsFromSheetOnly };
}

/**
 * API 데이터와 스프레드시트 데이터를 병합합니다.
 */
function mergeMusicData(apiData, sheetDataMap, newSongsFromSheetOnly) {
    console.log(`[3/5] API 데이터와 스프레드시트 데이터를 병합하는 중...`);
    let constUpdateCount = 0;
    let newSongCount = 0;
    const updatedSongs = [];
    const addedNewSongs = [];

    // API 데이터에 스프레드시트 정보를 보강합니다 (상수 업데이트만)
    apiData.forEach(music => {
        const title = music.meta.title;
        let songUpdated = false;
        
        // WORLD'S END 곡의 경우 Segament ID로 변경
        if (music.meta.genre === "WORLD'S END") {
            music.meta.id = generateSegamentId(title, music.meta.artist, true, music.meta.id);
        }
        
        // API에 장르 정보가 없으면, 시트에서 찾아봅니다.
        if (!music.meta.genre) {
            for (const diffKey in music.data) {
                const key = `${title}-${diffKey}`;
                if (sheetDataMap.has(key) && sheetDataMap.get(key).genre) {
                    music.meta.genre = sheetDataMap.get(key).genre;
                    break; 
                }
            }
        }
        
        for (const diffKey in music.data) {
            const key = `${title}-${diffKey}`;
            if (sheetDataMap.has(key)) {
                const sheetData = sheetDataMap.get(key);
                const apiDiffData = music.data[diffKey];

                // 1. 상수(const) 업데이트
                if (sheetData.const !== null && apiDiffData.const !== sheetData.const) {
                    apiDiffData.const = sheetData.const;
                    constUpdateCount++;
                    songUpdated = true;
                }
                
                // 2. 레벨(level) 업데이트 (API에 정보가 없을 경우)
                if (!apiDiffData.level && sheetData.level) {
                    apiDiffData.level = parseFloat(sheetData.level) || 0;
                }
                
                // 3. 데이터 구조 업데이트 (레벨 포맷팅 및 is_const_unknown 플래그)
                apiDiffData.level = formatLevel(apiDiffData.level);
                apiDiffData.is_const_unknown = (apiDiffData.const === 0 || !apiDiffData.const) && sheetData.const === null;
            } else {
                // 스프레드시트에 데이터가 없는 경우
                const apiDiffData = music.data[diffKey];
                apiDiffData.level = formatLevel(apiDiffData.level);
                apiDiffData.is_const_unknown = (apiDiffData.const === 0 || !apiDiffData.const);
            }
        }
        
        if (songUpdated) {
            updatedSongs.push(title);
        }
    });

    // 新曲のみ 시트에서만 신곡을 추가 (더 엄격한 조건)
    const apiMusicTitles = new Set(apiData.map(m => m.meta.title));
    
    console.log(`  - Chunirec API에 이미 존재하는 곡들과 新曲のみ 신곡 후보들을 비교 중...`);
    
    for (const [title, songInfo] of newSongsFromSheetOnly.entries()) {
        // API에 이미 존재하는지 엄격하게 확인
        if (!apiMusicTitles.has(title)) {
            console.log(`    - 신곡 발견: "${title}" (API에 없음)`);
            
            // 새로운 곡 추가
            const newSong = {
                meta: {
                    id: generateSegamentId(title), // Segament ID 생성
                    title: title,
                    genre: songInfo.genre || 'VARIETY',
                    artist: 'Unknown',
                    release: new Date().toISOString().split('T')[0],
                    bmp: 0
                },
                data: {}
            };
            
            // 각 난이도 데이터 추가
            for (const [difficulty, diffInfo] of songInfo.difficulties.entries()) {
                newSong.data[difficulty] = {
                    level: formatLevel(parseFloat(diffInfo.level) || 0),
                    const: diffInfo.const || 0,
                    maxcombo: 0,
                    is_const_unknown: diffInfo.const === null
                };
            }
            
            apiData.push(newSong);
            newSongCount++;
            addedNewSongs.push(title);
        } else {
            console.log(`    - "${title}" 곡은 이미 API에 존재함 (상수만 업데이트)`);
        }
    }

    console.log(`  - ${constUpdateCount}개의 보면 상수가 업데이트되었습니다.`);
    if (updatedSongs.length > 0) {
        console.log(`  - 업데이트된 곡 목록:`);
        updatedSongs.forEach(song => console.log(`    • ${song}`));
    }
    
    if (addedNewSongs.length > 0) {
        console.log(`  - ${newSongCount}개의 신곡이 新曲のみ 시트에서 추가되었습니다:`);
        addedNewSongs.forEach(song => console.log(`    • ${song}`));
    } else {
        console.log(`  - 新曲のみ 시트에서 추가할 신곡이 없습니다 (모든 곡이 이미 API에 존재함)`);
    }
    
    return apiData;
}

/**
 * 레벨을 포맷팅합니다 (n.0~n.4 -> n, n.5~n.9 -> n+)
 */
function formatLevel(level) {
    if (typeof level !== 'number') return level;
    const decimal = level % 1;
    const integer = Math.floor(level);
    return decimal >= 0.5 ? `${integer}+` : `${integer}`;
}

/**
 * 메인 실행 함수
 */
async function main() {
    // .env 파일 변수 검증
    if (!GOOGLE_API_KEY || !GOOGLE_SHEET_ID) {
        console.error('오류: .env 파일에 GOOGLE_API_KEY, GOOGLE_SHEET_ID를 설정해야 합니다.');
        process.exit(1);
    }

    try {
        console.log('[1/5] Chunirec API에서 최신 악곡 데이터를 가져오는 중...');
        
        // 인증 방식 2 (토큰을 쿼리 파라미터로) 기본 사용
        let response;
        try {
            response = await axios.get(`${API_BASE_URL}/music/showall.json`, apiConfig);
            console.log('  - 인증된 API로 데이터를 성공적으로 가져왔습니다.');
        } catch (authError) {
            console.log('  - 인증 API 실패, 공개 API로 시도 중...');
            try {
                response = await axios.get(`${API_BASE_URL}/music/showall.json`);
                console.log('  - 공개 API로 데이터를 성공적으로 가져왔습니다.');
            } catch (publicError) {
                throw authError; // 원래 인증 오류를 던짐
            }
        }
        
        const apiData = response.data;
        console.log(`  - ${apiData.length}개의 악곡 데이터를 성공적으로 불러왔습니다.`);

        const { sheetDataMap, newSongsFromSheetOnly } = await fetchAllDataFromGoogleSheet();
        
        const finalData = mergeMusicData(apiData, sheetDataMap, newSongsFromSheetOnly);

        console.log(`[4/5] 최종 데이터를 JSON 파일로 저장하는 중...`);
        await fs.writeJson(OUTPUT_JSON_PATH, finalData, { spaces: 2 });
        console.log(`  - 성공! 최종 데이터가 다음 경로에 저장되었습니다: ${OUTPUT_JSON_PATH}`);

        console.log(`[5/5] 상수가 0인 보면에 레벨값 적용 중...`);
        let levelAppliedCount = 0;
        
        const updatedData = finalData.map(music => {
            for (const diffKey in music.data) {
                const diffData = music.data[diffKey];
                if (diffData.level && (diffData.const === 0 || !diffData.const)) {
                    // 레벨이 존재하나 상수가 0인 경우, 레벨값을 상수로 적용
                    const levelNum = parseFloat(diffData.level.replace('+', '.5'));
                    if (!isNaN(levelNum)) {
                        music.data[diffKey].const = levelNum;
                        music.data[diffKey].is_const_unknown = false;
                        levelAppliedCount++;
                    }
                }
            }
            return music;
        });

        if (levelAppliedCount > 0) {
            console.log(`  - ${levelAppliedCount}개의 보면에 레벨값을 상수로 적용했습니다.`);
            console.log(`  - 업데이트된 데이터를 다시 저장하는 중...`);
            await fs.writeJson(OUTPUT_JSON_PATH, updatedData, { spaces: 2 });
            console.log(`  - 완료! 레벨값이 적용된 최종 데이터가 저장되었습니다.`);
        } else {
            console.log(`  - 레벨값을 적용할 보면이 없습니다.`);
        }

        console.log('\n=== 처리 완료 ===');
        console.log(`총 ${finalData.length}개의 곡이 처리되었습니다.`);
        console.log('✅ 안정성 개선: 이제 新曲のみ 시트에서만 신곡이 추가됩니다.');

    } catch (error) {
        if (error.response) {
            console.error(`\nAPI 호출 실패 (${error.response.status}): ${error.response.data.message || 'Chunirec API에서 오류가 발생했습니다.'}`);
            console.error('  - 액세스 토큰이 유효한지, .env 파일이 올바르게 설정되었는지 확인해주세요.');
        } else {
            console.error('\n데이터 업데이트에 실패했습니다:', error.message);
        }
        process.exit(1);
    }
}

// 스크립트 실행
main();
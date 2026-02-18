(async () => {
    const DEFAULT_ELEMENT_TIMEOUT_MS = 5000;
    const TIMEOUT_STEP_MS = 50;
    const RETRY_INTERVAL_MS = 100;

    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

    function click(element) {
        if (!element || element.hasAttribute('disabled') || element.disabled) return false;
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        return true;
    }

    async function processVideos() {
        const videoRows = [...document.querySelectorAll('ytcp-video-row')];
        console.log(`[작업 시작] 총 ${videoRows.length}개의 영상을 처리합니다.`);

        for (let idx = 0; idx < videoRows.length; idx++) {
            const row = videoRows[idx];
            const editBtn = row.querySelector('.edit-draft-button');
            if (!editBtn) continue;

            console.log(`[${idx + 1}/${videoRows.length}] 수정 창 여는 중...`);
            click(editBtn);

            let modal = null;
            for (let t = 0; t < 50; t++) {
                modal = document.querySelector('ytcp-uploads-dialog');
                if (modal) break;
                await sleep(50); // 모달 오픈 대기 단축
            }
            if (!modal) continue;

            // --- 2. '다음' 버튼 3번 클릭 ---
            for (let i = 1; i <= 3; i++) {
                let clicked = false;
                while (!clicked) {
                    const nextBtn = modal.querySelector('#next-button');
                    if (nextBtn && !nextBtn.disabled && !nextBtn.hasAttribute('disabled')) {
                        if (click(nextBtn)) {
                            clicked = true;
                            await sleep(150); // 전환 대기 최소화
                        }
                    } else {
                        await sleep(RETRY_INTERVAL_MS);
                    }
                }
            }

            // --- 3. 최종 저장 버튼 클릭 ---
            let saved = false;
            while (!saved) {
                const saveBtn = modal.querySelector('#done-button');
                if (saveBtn && !saveBtn.disabled) {
                    if (click(saveBtn)) {
                        console.log(`[${idx + 1}/${videoRows.length}] 저장 클릭`);
                        saved = true;
                    }
                } else {
                    await sleep(RETRY_INTERVAL_MS);
                }
            }

            // --- 4. 결과창 닫기 및 모달 소멸 동시 감시 (딜레이 최적화) ---
            let closed = false;
            let checkCount = 0;
            const MAX_CHECKS = 150; // 0.2초 * 150 = 30초

            while (!closed) {
                // 체크 주기를 0.2초로 단축하여 반응 속도 향상
                await sleep(200);
                checkCount++;

                // 1순위 체크: 메인 모달이 사라졌는가? (가장 빠른 탈출 조건)
                const mainModal = document.querySelector('ytcp-uploads-dialog');
                if (!mainModal || mainModal.offsetParent === null) {
                    console.log(`[${idx + 1}/${videoRows.length}] ✅ 모달 소멸 확인 (즉시 다음 이동)`);
                    closed = true;
                    break;
                }

                // 2순위 체크: 결과창 닫기 버튼이 보이는가?
                const selectors = [
                    'ytcp-video-share-dialog #close-button',
                    'ytcp-video-share-dialog #close-icon-button'
                ];

                for (let sel of selectors) {
                    const btn = document.querySelector(sel);
                    if (btn && btn.offsetParent !== null) {
                        click(btn);
                        const innerBtn = btn.querySelector('button');
                        if (innerBtn) click(innerBtn);

                        // 클릭 후 아주 짧게 대기하고 바로 다음 루프에서 모달 소멸 체크
                        await sleep(150);
                        break;
                    }
                }

                // 타임아웃 시 종료
                if (checkCount >= MAX_CHECKS) {
                    console.error(`[중단] 결과창 미감지 타임아웃.`);
                    return;
                }
            }

            console.log(`[${idx + 1}/${videoRows.length}] 작업 완료 ✓`);
            await sleep(100); // 영상 간 간격 최소화
        }
        console.log("[전체 종료]");
    }

    processVideos();
})();
